import { hasInput, INPUT, type InputMask } from './inputs';
import type { Level } from './level';
import type { PhysicsEngine } from './physics-engine';

/** One fixed simulation step, matching the server's re-simulation and the Box2D v3 samples' own default. */
export const TICK_SECONDS = 1 / 60;
const SUB_STEP_COUNT = 4;

/** Ticks a crash freezes input for before an automatic respawn at the last checkpoint. */
const CRASH_RESPAWN_TICKS = 60;
/** Chassis "up" dot with world-up below this = too far tilted: a crash (docs/design/GDD.md §5). */
const CRASH_UP_THRESHOLD = 0.15;
/** Below this world y (independent of the level's own killY) is always a fall, as a safety net. */
const ABSOLUTE_KILL_Y = -50;

export interface BikeState {
  readonly tick: number;
  readonly x: number;
  readonly y: number;
  /** Radians, world frame, for rendering. Not used for any gameplay decision (see crash detection below). */
  readonly angle: number;
  readonly vx: number;
  readonly vy: number;
  readonly rearWheelAngle: number;
  readonly frontWheelAngle: number;
  readonly checkpointIndex: number;
  readonly crashed: boolean;
  readonly crashedTicksAgo: number;
  readonly finished: boolean;
  readonly finishTick: number | null;
}

export interface BikeSimulation {
  /** Advances the simulation by exactly one tick given the input held during it. */
  step(input: InputMask): void;
  getState(): BikeState;
  /** Frees the WASM world. Call when the simulation is no longer needed (route change, unmount). */
  dispose(): void;
}

interface Body {
  id: unknown;
}

/**
 * Builds a chassis + two wheels connected by wheel joints (spring suspension + motor), matching the
 * official Box2D v3 "Wheel" sample (erincatto/box2d, samples/sample_joints.cpp) — confirmed against that
 * source 2026-09-24, not guessed: `localFrameA/B.p` from `b2Body_GetLocalPoint`, motor/spring fields set
 * directly on the joint def before `b2CreateWheelJoint`. The sample builds `localFrameA.q` with
 * `b2MakeRotFromUnitVector`, which this WASM binding does not expose (checked against its own .d.ts); the
 * vertical suspension axis this needs is the same rotation as `b2MakeRot(Math.PI / 2)` (its local x-axis,
 * the joint's slide direction, then points straight along y). `Math.PI` is a fixed IEEE-754 literal, not an
 * engine-approximated function, so this is exact and identical everywhere — unlike `Math.sin`/`Math.cos`.
 */
export function createBikeSimulation(engine: PhysicsEngine, level: Level): BikeSimulation {
  const {
    b2DefaultWorldDef,
    b2CreateWorld,
    b2World_Step,
    b2DefaultBodyDef,
    b2CreateBody,
    b2DefaultShapeDef,
    b2CreateSegmentShape,
    b2CreateCapsuleShape,
    b2CreateCircleShape,
    b2Segment,
    b2Capsule,
    b2Circle,
    b2Vec2,
    b2BodyType,
    b2DefaultWheelJointDef,
    b2CreateWheelJoint,
    b2WheelJoint_SetMotorSpeed,
    b2WheelJoint_SetMaxMotorTorque,
    b2Body_GetLocalPoint,
    b2MakeRot,
    b2Body_GetPosition,
    b2Body_GetRotation,
    b2Body_GetLinearVelocity,
    b2Body_ApplyTorque,
    b2Body_SetTransform,
    b2Body_SetLinearVelocity,
    b2Body_SetAngularVelocity,
    b2Rot_GetAngle,
    b2Rot_GetYAxis,
    b2Rot_identity,
  } = engine;

  const worldDef = b2DefaultWorldDef();
  worldDef.gravity = new b2Vec2(0, -10);
  // Box2D sleeps bodies that come to rest, and a sleeping body ignores joint motors — idling on the start
  // line for a few seconds left the bike unable to pull away at all (found by actually sitting still in the
  // browser; the tests never idled long enough to trigger it). Sleep is also accumulated-time state that
  // could diverge between a player's run and the server's re-simulation of it, so it stays off entirely.
  worldDef.enableSleep = false;
  const worldId = b2CreateWorld(worldDef);

  // --- Ground: one static segment per consecutive point pair. Box2D computes each segment's own geometry
  // from the two raw points, so level authoring never needs Math.atan2 or any other engine-approximated trig.
  const groundDef = b2DefaultBodyDef();
  const groundId = b2CreateBody(worldId, groundDef);
  for (let i = 0; i < level.ground.length - 1; i++) {
    const a = level.ground[i];
    const b = level.ground[i + 1];
    if (!a || !b) continue;
    const segment = new b2Segment();
    segment.point1 = new b2Vec2(a[0], a[1]);
    segment.point2 = new b2Vec2(b[0], b[1]);
    const shapeDef = b2DefaultShapeDef();
    shapeDef.material.friction = 1.0;
    b2CreateSegmentShape(groundId, shapeDef, segment);
  }

  // --- Chassis ---
  const chassisDef = b2DefaultBodyDef();
  chassisDef.type = b2BodyType.b2_dynamicBody;
  chassisDef.position = new b2Vec2(level.start.x, level.start.y);
  chassisDef.rotation = b2Rot_identity;
  chassisDef.angularDamping = 0.2;
  chassisDef.linearDamping = 0.02;
  const chassisId = b2CreateBody(worldId, chassisDef);
  const chassisCapsule = new b2Capsule();
  chassisCapsule.center1 = new b2Vec2(-0.45, 0);
  chassisCapsule.center2 = new b2Vec2(0.45, 0);
  chassisCapsule.radius = 0.3;
  const chassisShapeDef = b2DefaultShapeDef();
  chassisShapeDef.density = 1.2;
  chassisShapeDef.material.friction = 0.3;
  b2CreateCapsuleShape(chassisId, chassisShapeDef, chassisCapsule);

  const WHEEL_RADIUS = 0.4;
  function createWheel(offsetX: number): Body {
    const bodyDef = b2DefaultBodyDef();
    bodyDef.type = b2BodyType.b2_dynamicBody;
    bodyDef.position = new b2Vec2(level.start.x + offsetX, level.start.y - 0.35);
    bodyDef.rotation = b2Rot_identity;
    const bodyId = b2CreateBody(worldId, bodyDef);
    const circle = new b2Circle();
    circle.center = new b2Vec2(0, 0);
    circle.radius = WHEEL_RADIUS;
    const shapeDef = b2DefaultShapeDef();
    shapeDef.density = 1.0;
    shapeDef.material.friction = 1.4;
    b2CreateCircleShape(bodyId, shapeDef, circle);
    return { id: bodyId };
  }
  const rearWheel = createWheel(-0.55);
  const frontWheel = createWheel(0.55);

  // --- Tunables for input -> physics ---
  // Negative: a wheel rolling forward (+x, no slip) spins clockwise, i.e. negative angular velocity in
  // Box2D's CCW-positive convention (confirmed empirically — positive drove the bike backward).
  const DRIVE_WHEEL_SPEED = -45; // rad/s target when GAS is held
  // Kept low relative to the vehicle's ~2kg mass: the rear wheel's drive force acts at ground level, below
  // the chassis's centre of mass, so it also pitches the nose up (a real wheelie's mechanism) — empirically,
  // 9 N·m flipped the bike onto its back within ~0.8s of throttle, well before LEAN input could correct it.
  const DRIVE_MAX_TORQUE = 3.0;
  const BRAKE_MAX_TORQUE = 14;
  const LEAN_TORQUE = 5.5;

  function createWheelJoint(wheel: Body, pivot: InstanceType<typeof b2Vec2>, motorised: boolean) {
    const jointDef = b2DefaultWheelJointDef();
    jointDef.base.bodyIdA = chassisId;
    jointDef.base.bodyIdB = wheel.id as never;
    jointDef.base.collideConnected = false;
    jointDef.base.localFrameA.q = b2MakeRot(Math.PI / 2);
    jointDef.base.localFrameA.p = b2Body_GetLocalPoint(chassisId, pivot);
    jointDef.base.localFrameB.p = b2Body_GetLocalPoint(wheel.id as never, pivot);
    jointDef.enableSpring = true;
    jointDef.hertz = 5;
    jointDef.dampingRatio = 0.7;
    jointDef.enableLimit = true;
    jointDef.lowerTranslation = -0.12;
    jointDef.upperTranslation = 0.12;
    jointDef.enableMotor = motorised;
    jointDef.maxMotorTorque = motorised ? DRIVE_MAX_TORQUE : 0;
    jointDef.motorSpeed = 0;
    return b2CreateWheelJoint(worldId, jointDef);
  }
  const rearPivot = new b2Vec2(level.start.x - 0.55, level.start.y - 0.35);
  const frontPivot = new b2Vec2(level.start.x + 0.55, level.start.y - 0.35);
  const rearJointId = createWheelJoint(rearWheel, rearPivot, true);
  createWheelJoint(frontWheel, frontPivot, false);

  let tick = 0;
  let checkpointIndex = -1;
  let crashed = false;
  let crashedAtTick = -1;
  let finished = false;
  let finishTick: number | null = null;
  let lastGoodTransform = { x: level.start.x, y: level.start.y };

  function killY(): number {
    return Math.max(level.killY, ABSOLUTE_KILL_Y);
  }

  function respawnAtCheckpoint(): void {
    const x =
      checkpointIndex >= 0 ? (level.checkpoints[checkpointIndex] ?? level.start.x) : level.start.x;
    // Respawn a little above the recorded ground contact so the bike drops onto the track, not into it.
    const y = lastGoodTransform.y + 0.6;
    const zero = new b2Vec2(0, 0);
    for (const body of [chassisId, rearWheel.id as never, frontWheel.id as never]) {
      b2Body_SetTransform(body, new b2Vec2(x, y), b2Rot_identity);
      b2Body_SetLinearVelocity(body, zero);
      b2Body_SetAngularVelocity(body, 0);
    }
    crashed = false;
  }

  function step(input: InputMask): void {
    tick += 1;

    if (crashed) {
      if (tick - crashedAtTick >= CRASH_RESPAWN_TICKS) respawnAtCheckpoint();
    } else if (!finished) {
      const gas = hasInput(input, INPUT.GAS);
      const brake = hasInput(input, INPUT.BRAKE);
      if (gas && !brake) {
        b2WheelJoint_SetMotorSpeed(rearJointId, DRIVE_WHEEL_SPEED);
        b2WheelJoint_SetMaxMotorTorque(rearJointId, DRIVE_MAX_TORQUE);
      } else if (brake) {
        b2WheelJoint_SetMotorSpeed(rearJointId, 0);
        b2WheelJoint_SetMaxMotorTorque(rearJointId, BRAKE_MAX_TORQUE);
      } else {
        b2WheelJoint_SetMotorSpeed(rearJointId, 0);
        b2WheelJoint_SetMaxMotorTorque(rearJointId, 0.4); // gentle rolling resistance, not a hard lock
      }

      const leanBack = hasInput(input, INPUT.LEAN_BACK);
      const leanForward = hasInput(input, INPUT.LEAN_FORWARD);
      if (leanBack !== leanForward) {
        b2Body_ApplyTorque(chassisId, leanBack ? LEAN_TORQUE : -LEAN_TORQUE, true);
      }
    }

    b2World_Step(worldId, TICK_SECONDS, SUB_STEP_COUNT);

    const pos = b2Body_GetPosition(chassisId);
    const rot = b2Body_GetRotation(chassisId);
    const up = b2Rot_GetYAxis(rot);

    if (!crashed && !finished) {
      if (up.y < CRASH_UP_THRESHOLD || pos.y < killY()) {
        crashed = true;
        crashedAtTick = tick;
      } else {
        lastGoodTransform = { x: pos.x, y: pos.y };
        const nextCheckpoint = level.checkpoints[checkpointIndex + 1];
        if (nextCheckpoint !== undefined && pos.x >= nextCheckpoint) checkpointIndex += 1;
        if (pos.x >= level.finishX) {
          finished = true;
          finishTick = tick;
        }
      }
    }

    latestState = {
      tick,
      x: pos.x,
      y: pos.y,
      angle: b2Rot_GetAngle(rot),
      vx: b2Body_GetLinearVelocity(chassisId).x,
      vy: b2Body_GetLinearVelocity(chassisId).y,
      rearWheelAngle: b2Rot_GetAngle(b2Body_GetRotation(rearWheel.id as never)),
      frontWheelAngle: b2Rot_GetAngle(b2Body_GetRotation(frontWheel.id as never)),
      checkpointIndex,
      crashed,
      crashedTicksAgo: crashed ? tick - crashedAtTick : 0,
      finished,
      finishTick,
    };
  }

  let latestState: BikeState = {
    tick: 0,
    x: level.start.x,
    y: level.start.y,
    angle: 0,
    vx: 0,
    vy: 0,
    rearWheelAngle: 0,
    frontWheelAngle: 0,
    checkpointIndex: -1,
    crashed: false,
    crashedTicksAgo: 0,
    finished: false,
    finishTick: null,
  };

  return {
    step,
    getState: () => latestState,
    dispose: () => engine.b2DestroyWorld(worldId),
  };
}
