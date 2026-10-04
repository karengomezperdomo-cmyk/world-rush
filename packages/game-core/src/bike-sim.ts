import { hasInput, INPUT, type InputMask } from './inputs';
import { groundYAt, type Level } from './level';
import type { PhysicsEngine } from './physics-engine';

/** One fixed simulation step, matching the server's re-simulation and the Box2D v3 samples' own default. */
export const TICK_SECONDS = 1 / 60;
const SUB_STEP_COUNT = 4;

/** Ticks a crash freezes input for before an automatic respawn at the last checkpoint. */
export const CRASH_RESPAWN_TICKS = 60;

/**
 * The tank, in SECONDS OF THROTTLE rather than litres.
 *
 * Seconds are the unit the player actually feels and the unit a map is tuned in: a track takes 45-90 s and
 * most of it is spent on the gas, so "60 seconds of throttle" says immediately that finishing with the
 * throttle pinned the whole way is not an option, and that the cans on the track are the difference.
 *
 * Only GAS burns. Coasting, braking and leaning are free, which is what makes lifting off a real decision
 * instead of a mistake.
 */
export const DEFAULT_TANK_SECONDS = 60;
/** How close the chassis has to pass to a can to take it. Generous: this is a game, not a parking test. */
const FUEL_PICKUP_RADIUS = 1.3;
/**
 * The least fuel a continue hands back.
 *
 * Without a floor, running dry exactly at a checkpoint would put the player back on an empty tank, out of
 * fuel again on the next tick, for ever. Ten seconds is enough to reach the following checkpoint on every
 * map, and little enough that continuing is never a refuelling strategy.
 */
const CONTINUE_MINIMUM_SECONDS = 10;
/** Metres above the ground a respawn drops the bike from, so it settles instead of clipping into it. */
const RESPAWN_CLEARANCE = 1.0;
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
  /** Seconds of throttle left. Zero means the engine is dead and the bike only coasts. */
  readonly fuel: number;
  readonly outOfFuel: boolean;
  /** Which cans have been taken, one bit each, so the renderer can stop drawing them. */
  readonly takenCans: number;
  /** How many times the player has continued from a checkpoint after running dry. */
  readonly continues: number;
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
    b2CreatePolygonShape,
    b2MakeBox,
    b2ComputeHull,
    b2MakePolygon,
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

  // --- Ground: one static segment per consecutive point pair, WITHIN each strip. Segments are never made
  // between strips, which is what makes the space between them a real hole rather than a steep slope.
  // Box2D computes each segment's own geometry from the two raw points, so level authoring never needs
  // Math.atan2 or any other engine-approximated trig.
  const groundDef = b2DefaultBodyDef();
  const groundId = b2CreateBody(worldId, groundDef);
  for (const groundStrip of level.ground) {
    for (let i = 0; i < groundStrip.length - 1; i++) {
      const a = groundStrip[i];
      const b = groundStrip[i + 1];
      if (!a || !b) continue;
      const segment = new b2Segment();
      segment.point1 = new b2Vec2(a[0], a[1]);
      segment.point2 = new b2Vec2(b[0], b[1]);
      const shapeDef = b2DefaultShapeDef();
      shapeDef.material.friction = level.groundFriction ?? 1.0;
      b2CreateSegmentShape(groundId, shapeDef, segment);
    }
  }

  // --- Obstacles: static bodies the bike has to deal with rather than ride over.
  //
  // Each gets its own body at its own centre, so the shape is defined around the origin and the position
  // carries the placement. Built from the same level data on both the phone and the server, in the same
  // order, which is what keeps a replay verifiable.
  for (const block of level.blocks ?? []) {
    const bodyDef = b2DefaultBodyDef();
    bodyDef.position = new b2Vec2(block.x, block.y);
    const bodyId = b2CreateBody(worldId, bodyDef);
    const shapeDef = b2DefaultShapeDef();
    shapeDef.material.friction = level.groundFriction ?? 1.0;
    b2CreatePolygonShape(bodyId, shapeDef, b2MakeBox(block.width / 2, block.height / 2));
  }
  for (const round of level.rounds ?? []) {
    const bodyDef = b2DefaultBodyDef();
    bodyDef.position = new b2Vec2(round.x, round.y);
    const bodyId = b2CreateBody(worldId, bodyDef);
    const circle = new b2Circle();
    circle.center = new b2Vec2(0, 0);
    circle.radius = round.radius;
    const shapeDef = b2DefaultShapeDef();
    shapeDef.material.friction = level.groundFriction ?? 1.0;
    b2CreateCircleShape(bodyId, shapeDef, circle);
  }

  for (const ramp of level.ramps ?? []) {
    const bodyDef = b2DefaultBodyDef();
    bodyDef.position = new b2Vec2(ramp.x, ramp.y);
    const bodyId = b2CreateBody(worldId, bodyDef);
    // A right-facing wedge rises away from the rider; a left-facing one is the same triangle mirrored,
    // which is a landing ramp rather than a take-off.
    const peak = ramp.facing === 'left' ? 0 : ramp.width;
    const hull = b2ComputeHull([
      new b2Vec2(0, 0),
      new b2Vec2(ramp.width, 0),
      new b2Vec2(peak, ramp.height),
    ]);
    const shapeDef = b2DefaultShapeDef();
    shapeDef.material.friction = level.groundFriction ?? 1.0;
    b2CreatePolygonShape(bodyId, shapeDef, b2MakePolygon(hull, 0));
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
  let fuel = DEFAULT_TANK_SECONDS;
  /** The tank as it stood at the last checkpoint: what a respawn or a continue goes back to. */
  let fuelAtCheckpoint = DEFAULT_TANK_SECONDS;
  /** One bit per can taken. Never cleared, so no can can be collected twice. */
  let takenCans = 0;
  let continues = 0;
  let crashed = false;
  let crashedAtTick = -1;
  let finished = false;
  let finishTick: number | null = null;

  function killY(): number {
    return Math.max(level.killY, ABSOLUTE_KILL_Y);
  }

  function respawnAtCheckpoint(): void {
    const x =
      checkpointIndex >= 0 ? (level.checkpoints[checkpointIndex] ?? level.start.x) : level.start.x;
    // Drop onto the ground that is actually AT the respawn x. See groundYAt() for why using the bike's
    // last contact height instead made every map with elevation change unfinishable.
    const y = (groundYAt(level, x) ?? level.start.y) + RESPAWN_CLEARANCE;
    const zero = new b2Vec2(0, 0);
    // Each body goes back to its OWN offset, the same ones `createWheel` used. Teleporting all three to a
    // single point stacks the wheels inside the chassis, and Box2D resolves that overlap by blasting them
    // apart — which knocks the bike straight over into another crash, then another respawn. Found 2026-09-26
    // by riding Sunset Canyon: one bad landing locked the run into an endless crash loop at a checkpoint.
    const placements: [unknown, number, number][] = [
      [chassisId, x, y],
      [rearWheel.id, x - 0.55, y - 0.35],
      [frontWheel.id, x + 0.55, y - 0.35],
    ];
    for (const [body, bodyX, bodyY] of placements) {
      b2Body_SetTransform(body as never, new b2Vec2(bodyX, bodyY), b2Rot_identity);
      b2Body_SetLinearVelocity(body as never, zero);
      b2Body_SetAngularVelocity(body as never, 0);
    }
    crashed = false;
    // The tank goes back to what it held at the checkpoint, not to full: a crash - or a continue - must
    // not become a way to refuel. Taking the same can twice is impossible for the same reason, because
    // the taken-cans mask is never cleared.
    fuel = fuelAtCheckpoint;
  }

  /**
   * Takes every can the chassis is close enough to this tick.
   *
   * Distance is compared SQUARED, so no square root is involved: this runs every tick inside the
   * deterministic simulation, and the determinism lint bans the host maths that would creep in otherwise.
   */
  function takeFuelCans(x: number, y: number): void {
    const cans = level.fuelCans;
    if (!cans) return;
    for (let index = 0; index < cans.length; index++) {
      const bit = 1 << index;
      if ((takenCans & bit) !== 0) continue;
      const can = cans[index]!;
      const dx = can.x - x;
      const dy = can.y - y;
      if (dx * dx + dy * dy <= FUEL_PICKUP_RADIUS * FUEL_PICKUP_RADIUS) {
        takenCans |= bit;
        fuel = Math.min(DEFAULT_TANK_SECONDS, fuel + can.refill);
      }
    }
  }

  /**
   * Whether the chassis is inside a hazard.
   *
   * A point test against the chassis centre, not a Box2D sensor: sensors report through the contact
   * events of the step that produced them, which means reading them back in the right order every time on
   * both the phone and the server. A rectangle test on one position is the same answer everywhere, and
   * costs a handful of comparisons per tick.
   */
  function inHazard(x: number, y: number): boolean {
    for (const hazard of level.hazards ?? []) {
      const halfWidth = hazard.width / 2;
      const halfHeight = hazard.height / 2;
      if (
        x >= hazard.x - halfWidth &&
        x <= hazard.x + halfWidth &&
        y >= hazard.y - halfHeight &&
        y <= hazard.y + halfHeight
      ) {
        return true;
      }
    }
    return false;
  }

  function step(input: InputMask): void {
    tick += 1;

    // A continue only means anything once the tank is dry: pressed at any other moment it does nothing,
    // so it can never be used as a free teleport back to a checkpoint.
    if (hasInput(input, INPUT.CONTINUE) && fuel <= 0 && !finished) {
      continues += 1;
      // Continuing into an empty tank would strand the player at the checkpoint for ever, so the floor is
      // enough fuel to reach the next one.
      fuelAtCheckpoint = Math.max(fuelAtCheckpoint, CONTINUE_MINIMUM_SECONDS);
      respawnAtCheckpoint();
    }

    if (crashed) {
      if (tick - crashedAtTick >= CRASH_RESPAWN_TICKS) respawnAtCheckpoint();
    } else if (!finished) {
      // A dead engine still steers and still brakes; it just cannot drive.
      const gas = hasInput(input, INPUT.GAS) && fuel > 0;
      const brake = hasInput(input, INPUT.BRAKE);
      if (gas) fuel = Math.max(0, fuel - TICK_SECONDS);
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
      if (up.y < CRASH_UP_THRESHOLD || pos.y < killY() || inHazard(pos.x, pos.y)) {
        crashed = true;
        crashedAtTick = tick;
      } else {
        const nextCheckpoint = level.checkpoints[checkpointIndex + 1];
        if (nextCheckpoint !== undefined && pos.x >= nextCheckpoint) {
          checkpointIndex += 1;
          fuelAtCheckpoint = fuel;
        }
        takeFuelCans(pos.x, pos.y);
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
      fuel,
      outOfFuel: fuel <= 0,
      takenCans,
      continues,
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
    fuel: DEFAULT_TANK_SECONDS,
    outOfFuel: false,
    takenCans: 0,
    continues: 0,
  };

  return {
    step,
    getState: () => latestState,
    dispose: () => engine.b2DestroyWorld(worldId),
  };
}
