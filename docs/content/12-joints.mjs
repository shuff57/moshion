// moSHion docs: Joints. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#joints/<id>); never rename one, add a new page instead.

export default {
  slug: 'joints',
  title: "Joints",
  pages: [
    {
      id: 'glue',
      title: "GlueJoint",
      body: `A GlueJoint welds two sprites together so they move and rotate as a single rigid body. Create it with new GlueJoint(spriteA, spriteB) — just the two sprites, no options object.

Once glued, changing one sprite's position or velocity carries the other along. Gluing a dynamic sprite to a static one effectively pins it in place.

Like every joint, call joint.delete() to break the connection and let the sprites move independently again.`,
      code: `function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;
  new Sprite(200, 380, 400, 20, 'static');

  const stem = new Sprite(200, 200, 20, 100);
  const cap = new Sprite(200, 150, 100, 20);
  new GlueJoint(stem, cap);
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'distance',
      title: "DistanceJoint",
      body: `A DistanceJoint keeps two sprites at a fixed distance — the basis for ropes, tethers, and pendulum strings. Create it with new DistanceJoint(spriteA, spriteB, options).

Set joint.length after construction to change the target distance. The length is in pixels. You can also pass { length: 100 } in the options object at construction time.

Call joint.delete() to remove the constraint.`,
      code: `let tether;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;

  const anchor = new Sprite(200, 60, 16, 16, 'static');
  const ball = new Sprite(320, 60, 30);
  ball.color = 'tomato';

  tether = new DistanceJoint(anchor, ball);
  tether.length = 120;
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'hinge',
      title: "HingeJoint",
      body: `A HingeJoint pins two sprites at a shared point and lets them rotate around it. Use it for pendulums, swinging doors, and anything that needs to pivot.

Create it with new HingeJoint(spriteA, spriteB, options). Pass { anchor: { x, y } } in the options to set the pivot point in world coordinates — otherwise it defaults to spriteA's position.

Call joint.delete() to remove the hinge.`,
      code: `function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;

  const anchor = new Sprite(200, 80, 16, 16, 'static');
  const rod = new Sprite(200, 180, 16, 180);
  rod.color = 'khaki';

  new HingeJoint(anchor, rod);
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'hinge-limits',
      title: "Stiff hinges and limits",
      body: `A plain hinge swings freely, so a body built from hinges (a ragdoll, a robot arm) goes floppy. Two settings fix that.

stiffness, from 0 to 1, is how hard the hinge tries to stay in the pose it started in. 0 (the default) is floppy. 1 holds a limb up against gravity and springs it back after a hit. Something in between sags a little.

lowerLimit and upperLimit stop the hinge at an angle, in degrees, counted from the starting pose in the same direction as rotation. An elbow that only bends one way is { lowerLimit: 0, upperLimit: 140 }. Set one to null to take that limit off.

Pass them in the options, new HingeJoint(a, b, { stiffness: 0.6, lowerLimit: -45, upperLimit: 45 }), or change them later: elbow.stiffness = 0. joint.angle tells you how far it has turned from the starting pose.

Put the anchor where the two parts really meet (a shoulder, a knee). Without one, the pivot is the middle of the first sprite.`,
      code: `let elbow;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;

  const shoulder = new Sprite(120, 100, 16, 16, 'static');
  const upper = new Sprite(170, 100, 100, 18);
  const lower = new Sprite(260, 100, 80, 14);
  upper.color = 'khaki';
  lower.color = 'orange';

  new HingeJoint(shoulder, upper, { anchor: { x: 120, y: 100 }, stiffness: 1 });
  elbow = new HingeJoint(upper, lower, {
    anchor: { x: 220, y: 100 },
    stiffness: 0.5,
    lowerLimit: 0,
    upperLimit: 120,
  });
}

function update() {
  // Hold the mouse down to make the elbow floppy.
  elbow.stiffness = mouse.pressing() ? 0 : 0.5;
}

function draw() {
  background('#222');
  text('elbow: ' + round(elbow.angle) + ' degrees', 10, 20);
}`,
    },
    {
      id: 'slider',
      title: "SliderJoint",
      body: `A SliderJoint locks two sprites to a single axis of motion and forbids rotation between them. It's perfect for pistons, elevators, and sliding panels.

Create it with new SliderJoint(spriteA, spriteB, options). Pass { axis: { x, y } } to set the slide direction — { x: 0, y: 1 } for vertical, { x: 1, y: 0 } for horizontal. Drive the moving sprite with .vel along the axis.

Call joint.delete() to remove the constraint.`,
      code: `let base, piston;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  base = new Sprite(200, 200, 20, 20, 'static');
  piston = new Sprite(200, 260, 80, 20);
  piston.color = 'orange';

  new SliderJoint(base, piston, { axis: { x: 0, y: 1 } });
}

function update() {
  if (kb.pressing('up'))        piston.vel.y = -3;
  else if (kb.pressing('down')) piston.vel.y = 3;
  else                          piston.vel.y = 0;
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'wheel',
      title: "WheelJoint",
      body: `WheelJoint is built for vehicles. Pass the chassis as spriteA and the wheel as spriteB. The wheel can travel along an axis (giving you suspension) and spin freely.

Create it with new WheelJoint(chassis, wheel, options). Pass { axis: { x, y } } to set the suspension axis — { x: 0, y: 1 } for vertical suspension.

Drive the wheel by setting its angularVelocity each frame. Call joint.delete() to remove the constraint.`,
      code: `let chassis, wheel;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;
  new Sprite(200, 380, 400, 20, 'static');

  chassis = new Sprite(200, 300, 100, 20);
  wheel = new Sprite(180, 330, 26);
  wheel.friction = 1;
  new WheelJoint(chassis, wheel, { axis: { x: 0, y: 1 } });
}

function update() {
  if (kb.pressing('right'))     wheel.angularVelocity = 6;
  else if (kb.pressing('left')) wheel.angularVelocity = -6;
  else                          wheel.angularVelocity = 0;
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'grabber',
      title: "GrabberJoint",
      body: `A GrabberJoint pulls a physics sprite toward a target point with a spring force. It's how you drag boxes around in a physics puzzle: the box swings and tumbles on the way instead of teleporting.

Create it with new GrabberJoint(anchorSprite, draggedSprite, options). The anchor is any static sprite; the pull starts at the dragged sprite. Pass { maxForce: 200 } to control how strong the pull is — higher values feel snappier.

Move the target by setting joint.target to a point. grab.target = mouse every frame drags the sprite after the cursor.

Call joint.delete() (or joint.remove()) to let go.`,
      code: `let box, anchor, grab;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;
  new Sprite(200, 380, 400, 20, 'static');

  anchor = new Sprite(0, 0, 4, 4, 'static');
  anchor.visible = false;

  box = new Sprite(200, 300, 50, 50);
  box.color = 'deepskyblue';
}

function update() {
  if (mouse.presses() && world.getSpriteAt(mouse) === box) {
    grab = new GrabberJoint(anchor, box, { maxForce: 200 });
  }
  if (grab) grab.target = mouse;
  if (mouse.released() && grab) {
    grab.delete();
    grab = null;
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'every-joint',
      title: "Joint: what every joint shares",
      body: `Every joint (GlueJoint, DistanceJoint, HingeJoint, SliderJoint, WheelJoint, GrabberJoint) is a Joint. Make one with two different sprites that are both still in the game. If either is not a sprite, or you give the same one twice, you get a plain error.

joint.delete() takes a joint away, and joint.remove() does the same. sprite.joints lists the joints on a sprite.

Joints take an options object as the last argument. anchor is the point in the world where the joint pins the two sprites together, and each kind of joint has its own default for it. lowerLimit and upperLimit belong to HingeJoint: they stop it turning past an angle, in degrees from the pose it started in. maxForce is how hard a GrabberJoint is allowed to pull, and it is 100 unless you say otherwise.`,
    },
  ],
};
