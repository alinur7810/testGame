import React, { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Volume2, VolumeX, Shield, Award, Zap, Sparkles } from "lucide-react";
import { GameVariables, Platform, Collectible, Enemy, Particle } from "../types";

interface GameCanvasProps {
  variables: GameVariables;
  onCollect: (amount: number) => void;
  onHeightReached: (height: number) => void;
}

export default function GameCanvas({ variables, onCollect, onHeightReached }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Game States
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [maxHeight, setMaxHeight] = useState<number>(0);
  const [collectedCount, setCollectedCount] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Physics Refs (to avoid re-running useEffect)
  const playerRef = useRef({
    x: 200,
    y: 400,
    vx: 0,
    vy: 0,
    width: 24,
    height: 38,
    facing: 1, // -1 for left, 1 for right
    isGrounded: false,
    extraJumpsLeft: 1,
    dashCooldown: 0,
    dashActiveTimer: 0,
    dashDir: 0,
    isSlashing: false,
    slashTimer: 0,
    slashDir: 1,
    hitFlashTimer: 0,
  });

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const platformsRef = useRef<Platform[]>([]);
  const collectiblesRef = useRef<Collectible[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const cameraYRef = useRef<number>(0);
  const currentHeightRef = useRef<number>(0);
  const shakeTimerRef = useRef<number>(0);
  const reqAnimFrameRef = useRef<number | null>(null);

  // Synth sounds
  const playSound = (type: "jump" | "doubleJump" | "dash" | "collect" | "hit" | "slash") => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === "jump") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === "doubleJump") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === "dash") {
        // Noise or high pulse wave
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === "collect") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.12); // G5
        osc.frequency.setValueAtTime(1046.5, now + 0.18); // C6
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.2);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === "slash") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(150, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "hit") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.25);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  };

  // Spark Generator
  const createSparks = (x: number, y: number, color: string, count = 8) => {
    const adjustedCount = Math.round(count * variables.particlesDensity);
    for (let i = 0; i < adjustedCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5 + Math.random() * 2,
        color,
        alpha: 1,
        life: 0,
        maxLife: 30 + Math.random() * 30,
      });
    }
  };

  // Initialize Game Environment
  const initGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reset Player
    playerRef.current = {
      x: canvas.width / 2 - 12,
      y: 400,
      vx: 0,
      vy: 0,
      width: 24,
      height: 38,
      facing: 1,
      isGrounded: false,
      extraJumpsLeft: variables.doubleJumpEnabled ? 1 : 0,
      dashCooldown: 0,
      dashActiveTimer: 0,
      dashDir: 0,
      isSlashing: false,
      slashTimer: 0,
      slashDir: 1,
      hitFlashTimer: 0,
    };

    cameraYRef.current = 0;
    currentHeightRef.current = 0;
    shakeTimerRef.current = 0;
    setScore(0);
    setMaxHeight(0);
    setCollectedCount(0);
    setIsGameOver(false);

    // Initial Platforms
    const platforms: Platform[] = [
      { id: 1, x: canvas.width / 2 - 50, y: 550, width: 100, height: 12, type: "normal", vx: 0, rangeX: [0, 0], direction: 0 },
      { id: 2, x: 80, y: 440, width: 80, height: 12, type: "normal", vx: 0, rangeX: [0, 0], direction: 0 },
      { id: 3, x: 240, y: 340, width: 80, height: 12, type: "moving", vx: 1.5, rangeX: [50, 350], direction: 1 },
      { id: 4, x: 120, y: 220, width: 80, height: 12, type: "spring", vx: 0, rangeX: [0, 0], direction: 0 },
      { id: 5, x: 260, y: 100, width: 80, height: 12, type: "normal", vx: 0, rangeX: [0, 0], direction: 0 },
    ];
    platformsRef.current = platforms;

    // Initial Collectibles
    const collectibles: Collectible[] = [
      { id: 1, x: canvas.width / 2, y: 510, radius: 6, collected: false, pulsePhase: 0, type: "essence" },
      { id: 2, x: 120, y: 400, radius: 6, collected: false, pulsePhase: Math.PI / 2, type: "essence" },
      { id: 3, x: 280, y: 300, radius: 6, collected: false, pulsePhase: Math.PI, type: "soul" },
      { id: 4, x: 160, y: 170, radius: 6, collected: false, pulsePhase: Math.PI * 1.5, type: "super" },
    ];
    collectiblesRef.current = collectibles;

    // Initial Enemies
    const enemies: Enemy[] = [
      { id: 1, x: 150, y: 280, radius: 8, vx: 1.2, rangeX: [80, 320], direction: 1, angle: 0 },
    ];
    enemiesRef.current = enemies;

    // Ambient particles
    particlesRef.current = [];
    const ambientCount = 15;
    for (let i = 0; i < ambientCount; i++) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: -0.2 + Math.random() * 0.4,
        vy: -0.1 - Math.random() * 0.3,
        radius: 0.8 + Math.random() * 1.5,
        color: "#93c5fd",
        alpha: 0.1 + Math.random() * 0.4,
        life: 0,
        maxLife: 500 + Math.random() * 1000,
      });
    }
  };

  // Trigger game over
  const triggerGameOver = () => {
    setIsGameOver(true);
    setIsPlaying(false);
    playSound("hit");
    if (variables.cameraShakeEnabled) {
      shakeTimerRef.current = 20;
    }
  };

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = true;

      // Single trigger actions
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        // Let's handle jump triggers inside update loop to prevent double execution but allow single taps
      }

      if (e.key === "Shift" || e.key === "c" || e.key === "C") {
        triggerDash();
      }

      if (e.key === "z" || e.key === "Z") {
        triggerSlash();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [variables]);

  // Handle jump logic
  const triggerJump = () => {
    const p = playerRef.current;
    if (p.isGrounded) {
      p.vy = -variables.jumpForce;
      p.isGrounded = false;
      p.extraJumpsLeft = variables.doubleJumpEnabled ? 1 : 0;
      playSound("jump");
      createSparks(p.x + p.width / 2, p.y + p.height, "#38bdf8", 6);
    } else if (variables.doubleJumpEnabled && p.extraJumpsLeft > 0) {
      p.vy = -variables.jumpForce * 0.95;
      p.extraJumpsLeft--;
      playSound("doubleJump");
      createSparks(p.x + p.width / 2, p.y + p.height, "#c084fc", 10);
    }
  };

  const triggerDash = () => {
    if (!variables.dashEnabled) return;
    const p = playerRef.current;
    if (p.dashCooldown <= 0 && p.dashActiveTimer <= 0) {
      p.dashActiveTimer = 8; // 8 frames of dash
      p.dashCooldown = 35; // cooldown frames
      // Dash direction matches keyboard input, or facing direction if no horizontal keys
      let dDir = 0;
      if (keysPressed.current["ArrowLeft"] || keysPressed.current["a"] || keysPressed.current["A"]) dDir = -1;
      else if (keysPressed.current["ArrowRight"] || keysPressed.current["d"] || keysPressed.current["D"]) dDir = 1;
      else dDir = p.facing;

      p.dashDir = dDir;
      p.vy = 0; // suspend gravity
      playSound("dash");
      createSparks(p.x + p.width / 2, p.y + p.height / 2, "#22d3ee", 12);
      if (variables.cameraShakeEnabled) {
        shakeTimerRef.current = 6;
      }
    }
  };

  const triggerSlash = () => {
    const p = playerRef.current;
    if (!p.isSlashing) {
      p.isSlashing = true;
      p.slashTimer = 10; // 10 frames of active slash
      p.slashDir = p.facing;
      playSound("slash");

      // Slash recoil if downward slash (S / Down arrow pressed in air)
      const downPressed = keysPressed.current["ArrowDown"] || keysPressed.current["s"] || keysPressed.current["S"];
      
      // Perform physics overlap with enemies
      const slashRangeX = downPressed ? p.x - 20 : p.facing === 1 ? p.x + p.width : p.x - 35;
      const slashRangeY = downPressed ? p.y + p.height : p.y - 10;
      const slashWidth = downPressed ? p.width + 40 : 35;
      const slashHeight = downPressed ? 25 : p.height + 20;

      // Visual particles for slash
      createSparks(slashRangeX + slashWidth / 2, slashRangeY + slashHeight / 2, "#e2e8f0", 5);

      // Check hits on enemies
      enemiesRef.current = enemiesRef.current.filter((enemy) => {
        const hit = (
          slashRangeX < enemy.x + enemy.radius &&
          slashRangeX + slashWidth > enemy.x - enemy.radius &&
          slashRangeY < enemy.y + enemy.radius &&
          slashRangeY + slashHeight > enemy.y - enemy.radius
        );

        if (hit) {
          // Bounce off enemy (Hollow Knight pogo mechanic!)
          if (downPressed && !p.isGrounded) {
            p.vy = -variables.jumpForce * 0.9;
            p.extraJumpsLeft = variables.doubleJumpEnabled ? 1 : 0;
          } else {
            p.vx = -p.facing * 4; // horizontal recoil
          }
          createSparks(enemy.x, enemy.y, "#f43f5e", 15);
          setScore((s) => s + 50);
          onCollect(50);
          if (variables.cameraShakeEnabled) {
            shakeTimerRef.current = 10;
          }
          playSound("hit");
          return false; // delete enemy
        }
        return true; // keep enemy
      });
    }
  };

  // Main game loop
  const updateLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check specific jump press with key latch to avoid spam
    if (
      (keysPressed.current[" "] || keysPressed.current["ArrowUp"] || keysPressed.current["w"] || keysPressed.current["W"]) &&
      !keysPressed.current["_jumpLatched"]
    ) {
      triggerJump();
      keysPressed.current["_jumpLatched"] = true;
    }
    if (
      !(keysPressed.current[" "] || keysPressed.current["ArrowUp"] || keysPressed.current["w"] || keysPressed.current["W"])
    ) {
      keysPressed.current["_jumpLatched"] = false;
    }

    const p = playerRef.current;

    // Cooldown reductions
    if (p.dashCooldown > 0) p.dashCooldown--;
    if (p.dashActiveTimer > 0) p.dashActiveTimer--;
    if (p.slashTimer > 0) {
      p.slashTimer--;
      if (p.slashTimer === 0) p.isSlashing = false;
    }
    if (p.hitFlashTimer > 0) p.hitFlashTimer--;
    if (shakeTimerRef.current > 0) shakeTimerRef.current--;

    // 1. PHYSICS UPDATE
    if (p.dashActiveTimer > 0) {
      // Dashing - move straight
      p.vx = p.dashDir * variables.maxSpeed * 2.5;
      p.vy = 0;
      p.isGrounded = false;
      // Spawn trail particle
      if (Math.random() < 0.4) {
        particlesRef.current.push({
          x: p.x + Math.random() * p.width,
          y: p.y + Math.random() * p.height,
          vx: -p.vx * 0.1,
          vy: 0,
          radius: 2 + Math.random() * 2,
          color: "#06b6d4",
          alpha: 0.6,
          life: 0,
          maxLife: 15,
        });
      }
    } else {
      // Normal Horizontal Movement
      let moveDir = 0;
      if (keysPressed.current["ArrowLeft"] || keysPressed.current["a"] || keysPressed.current["A"]) {
        moveDir = -1;
        p.facing = -1;
      } else if (keysPressed.current["ArrowRight"] || keysPressed.current["d"] || keysPressed.current["D"]) {
        moveDir = 1;
        p.facing = 1;
      }

      if (moveDir !== 0) {
        p.vx += moveDir * 0.6;
        if (Math.abs(p.vx) > variables.maxSpeed) {
          p.vx = Math.sign(p.vx) * variables.maxSpeed;
        }
        // Run dust particles on ground
        if (p.isGrounded && Math.random() < 0.25) {
          particlesRef.current.push({
            x: p.x + (p.facing === 1 ? 0 : p.width),
            y: p.y + p.height,
            vx: -p.vx * 0.2 + (Math.random() - 0.5) * 0.5,
            vy: -0.2 - Math.random() * 0.5,
            radius: 1 + Math.random() * 2,
            color: "#6b7280",
            alpha: 0.4,
            life: 0,
            maxLife: 20,
          });
        }
      } else {
        // Friction
        p.vx *= 0.8;
        if (Math.abs(p.vx) < 0.1) p.vx = 0;
      }

      // Gravity
      p.vy += 0.22 * variables.gravityScale;
      if (p.vy > 12) p.vy = 12; // Terminal velocity
    }

    // Apply Velocities
    p.x += p.vx;
    p.y += p.vy;

    // Screen boundaries wrapping
    if (p.x < -p.width) p.x = canvas.width;
    else if (p.x > canvas.width) p.x = -p.width;

    // 2. CAMERAS VERTICAL SCROLLING (Doodle Jump mechanic)
    // Target camera is based on player climbing high
    const targetCameraY = p.y - canvas.height * 0.4;
    if (-targetCameraY > cameraYRef.current) {
      // smooth camera scroll upwards
      cameraYRef.current += (-targetCameraY - cameraYRef.current) * 0.1;
    }

    // Current climbed height
    const currentClimbedHeight = Math.floor(-cameraYRef.current);
    if (currentClimbedHeight > currentHeightRef.current) {
      currentHeightRef.current = currentClimbedHeight;
      onHeightReached(currentClimbedHeight);
      setScore((s) => {
        const newScore = s + (currentClimbedHeight - currentHeightRef.current);
        return Math.max(newScore, s);
      });
      if (currentClimbedHeight > maxHeight) {
        setMaxHeight(currentClimbedHeight);
      }
    }

    // Recycler: If player falls way below visible viewport - GAME OVER
    if (p.y - cameraYRef.current > canvas.height + 100) {
      triggerGameOver();
      return;
    }

    // 3. MOVING PLATFORMS & COLLISION
    p.isGrounded = false;
    platformsRef.current.forEach((plat) => {
      // Update moving platforms horizontal motion
      if (plat.type === "moving") {
        plat.x += plat.vx * plat.direction;
        if (plat.x < plat.rangeX[0]) {
          plat.x = plat.rangeX[0];
          plat.direction = 1;
        } else if (plat.x + plat.width > plat.rangeX[1]) {
          plat.x = plat.rangeX[1] - plat.width;
          plat.direction = -1;
        }
      }

      // Check player fall landing
      if (p.vy >= 0 && p.dashActiveTimer <= 0) {
        const overlapX = p.x + p.width > plat.x && p.x < plat.x + plat.width;
        const overlapY = p.y + p.height >= plat.y && p.y + p.height - p.vy <= plat.y + plat.height;

        if (overlapX && overlapY) {
          // Landing!
          p.y = plat.y - p.height;
          p.isGrounded = true;
          p.extraJumpsLeft = variables.doubleJumpEnabled ? 1 : 0;

          if (plat.type === "spring") {
            // Spring bounce!
            p.vy = -variables.bounceForce;
            p.isGrounded = false;
            plat.bounced = true;
            setTimeout(() => { plat.bounced = false; }, 200);
            playSound("jump");
            createSparks(plat.x + plat.width / 2, plat.y, "#eab308", 12);
            if (variables.cameraShakeEnabled) {
              shakeTimerRef.current = 8;
            }
          } else {
            p.vy = 0;
            // Carry horizontal speed if platform is moving
            if (plat.type === "moving") {
              p.x += plat.vx * plat.direction;
            }
          }
        }
      }
    });

    // 4. ENEMIES PHYSICS
    enemiesRef.current.forEach((enemy) => {
      enemy.x += enemy.vx * enemy.direction;
      enemy.angle += 0.05;
      if (enemy.x - enemy.radius < enemy.rangeX[0]) {
        enemy.x = enemy.rangeX[0] + enemy.radius;
        enemy.direction = 1;
      } else if (enemy.x + enemy.radius > enemy.rangeX[1]) {
        enemy.x = enemy.rangeX[1] - enemy.radius;
        enemy.direction = -1;
      }

      // Collision with Player
      if (p.hitFlashTimer <= 0 && p.dashActiveTimer <= 0) {
        const dist = Math.hypot(p.x + p.width / 2 - enemy.x, p.y + p.height / 2 - enemy.y);
        if (dist < enemy.radius + 12) {
          // HIT!
          p.hitFlashTimer = 30; // flash player red
          p.vy = -6; // knockback up
          p.vx = p.facing * -4; // knockback away
          setScore((s) => Math.max(0, s - 100)); // lose points
          playSound("hit");
          createSparks(p.x + p.width / 2, p.y + p.height / 2, "#ef4444", 15);
          if (variables.cameraShakeEnabled) {
            shakeTimerRef.current = 15;
          }
        }
      }
    });

    // 5. COLLECTIBLES
    collectiblesRef.current.forEach((c) => {
      if (c.collected) return;
      c.pulsePhase += 0.04;

      // Check collision
      const dist = Math.hypot(p.x + p.width / 2 - c.x, p.y + c.radius - c.y);
      if (dist < c.radius + 16) {
        c.collected = true;
        const val = c.type === "super" ? variables.collectibleValue * 3 : c.type === "soul" ? variables.collectibleValue * 2 : variables.collectibleValue;
        setScore((s) => s + val);
        setCollectedCount((count) => count + 1);
        onCollect(val);
        playSound("collect");
        createSparks(c.x, c.y, c.type === "super" ? "#facc15" : c.type === "soul" ? "#ec4899" : "#c084fc", 14);
      }
    });

    // Recycle platforms, collectibles and enemies as camera scrolls up
    // Check if lowest platforms are out of view and place them at top
    platformsRef.current = platformsRef.current.map((plat) => {
      if (plat.y - cameraYRef.current > canvas.height + 150) {
        const highestPlatY = Math.min(...platformsRef.current.map((pl) => pl.y));
        const newY = highestPlatY - (100 + Math.random() * 50);
        const newWidth = 65 + Math.random() * 40;
        const newX = Math.random() * (canvas.width - newWidth);
        const types: Platform["type"][] = ["normal", "normal", "moving", "spring"];
        if (Math.random() < 0.15) types.push("hazard");
        const newType = types[Math.floor(Math.random() * types.length)];

        // Generate matching collectible sometimes
        if (Math.random() < 0.6) {
          const typesCol: Collectible["type"][] = ["essence", "essence", "soul"];
          if (Math.random() < 0.1) typesCol.push("super");
          collectiblesRef.current.push({
            id: Date.now() + Math.random(),
            x: newX + newWidth / 2,
            y: newY - 20 - Math.random() * 30,
            radius: 5,
            collected: false,
            pulsePhase: Math.random() * Math.PI,
            type: typesCol[Math.floor(Math.random() * typesCol.length)],
          });
        }

        // Spawn matching floating enemy sometimes
        if (Math.random() < 0.25 && newType !== "hazard") {
          enemiesRef.current.push({
            id: Date.now() + Math.random(),
            x: Math.random() * canvas.width,
            y: newY - 50 - Math.random() * 40,
            radius: 8,
            vx: 0.8 + Math.random() * 1.2,
            rangeX: [40, canvas.width - 40],
            direction: Math.random() > 0.5 ? 1 : -1,
            angle: Math.random() * Math.PI,
          });
        }

        return {
          id: plat.id,
          x: newX,
          y: newY,
          width: newWidth,
          height: 12,
          type: newType,
          vx: newType === "moving" ? 1 + Math.random() * 1.5 : 0,
          rangeX: [30, canvas.width - 30],
          direction: Math.random() > 0.5 ? 1 : -1,
        };
      }
      return plat;
    });

    // Clean up collected/out-of-view collectibles and old enemies to keep performance high
    collectiblesRef.current = collectiblesRef.current.filter((c) => c.y - cameraYRef.current < canvas.height + 200 && !c.collected);
    enemiesRef.current = enemiesRef.current.filter((e) => e.y - cameraYRef.current < canvas.height + 200);

    // Update particles
    particlesRef.current = particlesRef.current.map((part) => {
      part.x += part.vx;
      part.y += part.vy;
      part.life++;
      if (part.maxLife > 100) {
        // drifting background glow, stay visible
        if (part.y - cameraYRef.current > canvas.height + 100) {
          part.y = cameraYRef.current - 50;
          part.x = Math.random() * canvas.width;
        }
      } else {
        part.alpha = 1 - part.life / part.maxLife;
      }
      return part;
    }).filter((part) => part.life < part.maxLife);

    // 6. RENDER EVERYTHING
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Camera Shake
    ctx.save();
    if (shakeTimerRef.current > 0 && variables.cameraShakeEnabled) {
      const dx = (Math.random() - 0.5) * 6;
      const dy = (Math.random() - 0.5) * 6;
      ctx.translate(dx, dy);
    }

    // Background Gradient (Cozy Dark Caves / Hollow Knight vibe)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, "#0c1120");
    skyGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vignette Effect
    const vig = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
      canvas.width / 2, canvas.height / 2, canvas.height * 0.7
    );
    vig.addColorStop(0, "rgba(0, 0, 0, 0)");
    vig.addColorStop(1, "rgba(2, 4, 10, 0.75)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines for C#/Unity visual editor feel
    ctx.strokeStyle = "rgba(147, 197, 253, 0.03)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    const startYOffset = Math.floor(cameraYRef.current % gridSize);
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = startYOffset; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Apply Camera Viewport offset (climbing up moves world down)
    ctx.translate(0, cameraYRef.current);

    // Draw Background Particles (Fireflies / Dust)
    particlesRef.current.forEach((part) => {
      if (part.maxLife > 100) {
        ctx.fillStyle = part.color;
        ctx.globalAlpha = part.alpha * (0.5 + Math.sin(Date.now() * 0.003 + part.x) * 0.4);
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    // Draw Platforms
    platformsRef.current.forEach((plat) => {
      // Platform base body
      ctx.shadowBlur = 12;
      if (plat.type === "spring") {
        ctx.shadowColor = "#eab308";
        ctx.fillStyle = "#2d2204";
        ctx.strokeStyle = "#fbbf24";
      } else if (plat.type === "moving") {
        ctx.shadowColor = "#ec4899";
        ctx.fillStyle = "#2a081c";
        ctx.strokeStyle = "#f472b6";
      } else if (plat.type === "hazard") {
        ctx.shadowColor = "#f43f5e";
        ctx.fillStyle = "#2b040a";
        ctx.strokeStyle = "#fda4af";
      } else {
        ctx.shadowColor = "#38bdf8";
        ctx.fillStyle = "#081b29";
        ctx.strokeStyle = "#60a5fa";
      }

      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(plat.x, plat.y, plat.width, plat.height, 4);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw spiked hazard accents
      if (plat.type === "hazard") {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        for (let sx = plat.x + 5; sx < plat.x + plat.width; sx += 12) {
          ctx.moveTo(sx, plat.y);
          ctx.lineTo(sx + 5, plat.y - 6);
          ctx.lineTo(sx + 10, plat.y);
        }
        ctx.fill();
      }

      // Animated Spring board top plate
      if (plat.type === "spring") {
        ctx.fillStyle = "#facc15";
        const springOffset = plat.bounced ? 5 : 0;
        ctx.fillRect(plat.x + 10, plat.y - 3 + springOffset, plat.width - 20, 4);
      }
    });

    // Draw Collectibles
    collectiblesRef.current.forEach((c) => {
      if (c.collected) return;
      const pulse = Math.sin(c.pulsePhase) * 2;

      ctx.save();
      ctx.shadowBlur = 15;
      if (c.type === "super") {
        ctx.shadowColor = "#facc15";
        ctx.fillStyle = "#fef08a";
      } else if (c.type === "soul") {
        ctx.shadowColor = "#ec4899";
        ctx.fillStyle = "#fbcfe8";
      } else {
        ctx.shadowColor = "#c084fc";
        ctx.fillStyle = "#e9d5ff";
      }

      // Draw as glowing diamond star
      ctx.beginPath();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.pulsePhase * 0.4);
      const rad = c.radius + pulse * 0.5;
      ctx.moveTo(0, -rad - 2);
      ctx.lineTo(rad, 0);
      ctx.lineTo(0, rad + 2);
      ctx.lineTo(-rad, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Draw Enemies (Atmospheric dark spike entities like Hollow Knight's Belfly or Crawlid)
    enemiesRef.current.forEach((e) => {
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#f43f5e";
      ctx.fillStyle = "#1e1b4b";
      ctx.strokeStyle = "#fda4af";
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Glowing angry red eyes
      ctx.fillStyle = "#ef4444";
      const eyeOffset = e.direction * 3;
      ctx.beginPath();
      ctx.arc(e.x - 2 + eyeOffset, e.y - 1, 1.5, 0, Math.PI * 2);
      ctx.arc(e.x + 3 + eyeOffset, e.y - 1, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Sharp glowing legs/spikes
      ctx.strokeStyle = "#fda4af";
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = e.angle + (i * Math.PI) / 3;
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(angle) * (e.radius + 4), e.y + Math.sin(angle) * (e.radius + 4));
      }
      ctx.stroke();
      ctx.restore();
    });

    // Draw Sparks Particles
    particlesRef.current.forEach((part) => {
      if (part.maxLife <= 100) {
        ctx.fillStyle = part.color;
        ctx.globalAlpha = part.alpha;
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    // Draw Player Slash/Attack Visual Sweep
    if (p.isSlashing) {
      ctx.save();
      ctx.strokeStyle = "rgba(226, 232, 240, 0.85)";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#e2e8f0";

      ctx.beginPath();
      const slashAngleStart = p.slashDir === 1 ? -0.4 * Math.PI : 0.6 * Math.PI;
      const slashAngleEnd = p.slashDir === 1 ? 0.4 * Math.PI : 1.4 * Math.PI;

      // Draw downward sweep if crouch/down pressed
      const downPressed = keysPressed.current["ArrowDown"] || keysPressed.current["s"] || keysPressed.current["S"];
      if (downPressed && !p.isGrounded) {
        ctx.arc(p.x + p.width / 2, p.y + p.height + 10, 30, 0.1 * Math.PI, 0.9 * Math.PI);
      } else {
        ctx.arc(p.x + (p.slashDir === 1 ? p.width : 0), p.y + p.height / 2, 35, slashAngleStart, slashAngleEnd);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw Player (The Glowing White Knight)
    ctx.save();
    if (p.hitFlashTimer > 0 && Math.floor(p.hitFlashTimer / 3) % 2 === 0) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#ef4444";
      ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
    } else {
      ctx.shadowBlur = 18;
      ctx.shadowColor = variables.playerColor;
      ctx.fillStyle = "#ffffff";
    }

    // Simple procedural Knight Body (Cute capsule with legs and a flowing dark cape)
    // Cape trail
    ctx.fillStyle = "#334155";
    ctx.shadowBlur = 0;
    ctx.beginPath();
    const capeX = p.facing === 1 ? p.x : p.x + p.width;
    const capeWave = Math.sin(Date.now() * 0.015) * 3;
    ctx.moveTo(capeX, p.y + 10);
    ctx.lineTo(capeX - p.facing * (15 + capeWave), p.y + 25 + capeWave);
    ctx.lineTo(capeX - p.facing * 5, p.y + 35);
    ctx.closePath();
    ctx.fill();

    // Body Capsule
    if (p.hitFlashTimer > 0 && Math.floor(p.hitFlashTimer / 3) % 2 === 0) {
      ctx.fillStyle = "#ef4444";
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 10);
    ctx.fill();

    // Mask/Face shadow
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(p.x + (p.facing === 1 ? 4 : 2), p.y + 4, p.width - 6, 12, 4);
    ctx.fill();

    // Small glowing Knight Eyes (Dual small circles)
    ctx.fillStyle = variables.playerColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = variables.playerColor;
    ctx.beginPath();
    const eyeBaseX = p.x + (p.facing === 1 ? 10 : 4);
    ctx.arc(eyeBaseX, p.y + 10, 2.2, 0, Math.PI * 2);
    ctx.arc(eyeBaseX + 6, p.y + 10, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Tiny hollow horns (Classic Hollow Knight style)
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 0;
    ctx.beginPath();
    // Left horn
    ctx.moveTo(p.x + 4, p.y);
    ctx.quadraticCurveTo(p.x + 1, p.y - 10, p.x - 1, p.y - 12);
    ctx.quadraticCurveTo(p.x + 6, p.y - 6, p.x + 8, p.y);
    // Right horn
    ctx.moveTo(p.x + p.width - 8, p.y);
    ctx.quadraticCurveTo(p.x + p.width - 6, p.y - 6, p.x + p.width + 1, p.y - 12);
    ctx.quadraticCurveTo(p.x + p.width - 1, p.y - 10, p.x + p.width - 4, p.y);
    ctx.fill();

    ctx.restore();

    ctx.restore(); // Restore Camera Shake state

    // Request Next Frame
    reqAnimFrameRef.current = requestAnimationFrame(updateLoop);
  };

  // Start or stop animation loop based on playing status
  useEffect(() => {
    if (isPlaying && !isGameOver) {
      reqAnimFrameRef.current = requestAnimationFrame(updateLoop);
    } else {
      if (reqAnimFrameRef.current) {
        cancelAnimationFrame(reqAnimFrameRef.current);
      }
    }
    return () => {
      if (reqAnimFrameRef.current) {
        cancelAnimationFrame(reqAnimFrameRef.current);
      }
    };
  }, [isPlaying, isGameOver, variables]);

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
  };

  return (
    <div id="game-container" ref={containerRef} className="relative flex flex-col items-center select-none w-full max-w-lg mx-auto bg-slate-950/50 rounded-2xl overflow-hidden border border-white/10 backdrop-blur-xl shadow-2xl">
      {/* Top Bar Status Panel */}
      <div className="w-full bg-slate-950/70 border-b border-white/10 px-4 py-3 flex items-center justify-between z-10 backdrop-blur-md">
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Essence</span>
            <span className="text-sm font-bold text-amber-400 flex items-center gap-1 font-mono">
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400 shadow-[0_0_10px_#fbbf24]" />
              {score}
            </span>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Height</span>
            <span className="text-sm font-bold text-teal-400 font-mono">
              {maxHeight}m
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleSound}
            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          {!isPlaying && !isGameOver ? (
            <button
              onClick={() => {
                initGame();
                setIsPlaying(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg text-xs font-semibold shadow-md shadow-teal-500/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-slate-950 text-slate-950" />
              Старт
            </button>
          ) : (
            <button
              onClick={() => {
                initGame();
                setIsPlaying(true);
              }}
              className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Restart Game"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative w-full aspect-[4/5] flex items-center justify-center bg-slate-950">
        <canvas
          ref={canvasRef}
          width={400}
          height={500}
          className="w-full h-full block bg-[#0c1120]"
        />

        {/* Start Game Overlay */}
        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 bg-[#0c1120]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mb-4 text-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.2)] animate-pulse">
              <Shield className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Hollow Jump</h3>
            <p className="text-xs text-slate-300 max-w-xs mb-6 leading-relaxed">
              Управляйте маленьким Рыцарем! Прыгайте по платформам, уворачивайтесь от шипов и собирайте души.
            </p>

            <div className="grid grid-cols-2 gap-3 text-left w-full max-w-xs mb-6 text-[11px] text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-white/10 font-mono">
              <div><span className="text-teal-400">A / D</span> - Движение</div>
              <div><span className="text-teal-400">Space</span> - Прыжок</div>
              <div><span className="text-teal-400">Shift</span> - Рывок (Дэш)</div>
              <div><span className="text-teal-400">Z / Click</span> - Слэш (Удар)</div>
            </div>

            <button
              onClick={() => {
                initGame();
                setIsPlaying(true);
              }}
              className="px-6 py-2 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-teal-950/50 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              Играть
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {isGameOver && (
          <div className="absolute inset-0 bg-[#0c1120]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <Award className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-red-400 mb-1 tracking-tight">Рыцарь пал!</h3>
            <p className="text-xs text-slate-300 mb-6 font-mono">Вы поднялись на {maxHeight} метров</p>

            <div className="flex flex-col gap-2 w-full max-w-xs bg-slate-950/55 border border-white/10 p-3 rounded-xl mb-6 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Собрано душ:</span>
                <span className="text-amber-400 font-bold">{collectedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Итоговый счёт:</span>
                <span className="text-teal-400 font-bold">{score}</span>
              </div>
            </div>

            <button
              onClick={() => {
                initGame();
                setIsPlaying(true);
              }}
              className="flex items-center justify-center gap-1.5 px-6 py-2.5 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-teal-950/40 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Ещё раз
            </button>
          </div>
        )}
      </div>

      {/* Bottom Bar Hints */}
      <div className="w-full bg-slate-950/95 px-4 py-2 flex justify-between text-[10px] text-slate-400 font-mono border-t border-white/10">
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-teal-400" />
          Shift для Рывка вбок
        </span>
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Удар монстра сверху (S+Z), чтобы подпрыгнуть!
        </span>
      </div>
    </div>
  );
}
