import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API route to handle custom Unity C# script and gameplay adjustments generation
app.post("/api/generate-unity-script", async (req, res) => {
  try {
    const { prompt, currentVariables, activeComponent } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      // Return beautiful mock/fallback response if API key is not present, to ensure offline usability
      return res.json(getFallbackResponse(prompt, activeComponent));
    }

    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemInstruction = `
You are an expert Unity 2D game developer and C# programmer.
The user is building a light 2D vertical/moving-platform platformer game, styled like a cozy Hollow Knight with Doodle Jump elements (collecting glowing essence, jumping higher on moving/bouncing platforms, double jumps, dashing, particle trails).

Your task is to:
1. Write a high-quality, professional, and well-commented Unity C# MonoBehaviour script corresponding to the user's requested mechanics or adjustments (e.g., adding double jump, dashing, custom physics, spring platforms, camera shake, visual trails, hook/grappling, or simple AI enemies).
2. Write a detailed, friendly, step-by-step instruction manual in Russian on how to integrate this script in the Unity editor (what GameObjects to create, what components to attach, how to set Up Rigidbodies, Colliders, tags, and LayerMasks).
3. Provide adjustments for our playable HTML5 Canvas game engine so the user can immediately "play" and test the mechanics in the web preview.

The web game supports these variable options:
- doubleJumpEnabled (boolean)
- jumpForce (number, base 12)
- gravityScale (number, base 2.2)
- dashEnabled (boolean, base true)
- maxSpeed (number, base 5)
- collectibleValue (number, base 10)
- particlesDensity (number, base 1)
- bounceForce (number, base 15)
- playerColor (string, CSS color like '#a855f7' or '#06b6d4')
- cameraShakeEnabled (boolean)
- activeScriptComponent (string, which script is being displayed: "PlayerController", "MovingPlatform", "Collectible", or a custom script name)

Respond ONLY with a valid JSON matching the schema specified.
All text explanations, comments inside code, and integration guides MUST be in Russian.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `
User prompt: "${prompt}"
Current active component in focus: "${activeComponent || "PlayerController"}"
Current game variables: ${JSON.stringify(currentVariables || {})}

Please generate the Unity C# script, the step-by-step Russian Unity guide, the HTML5 game variable updates, and a brief summary.
`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            code: {
              type: Type.STRING,
              description: "Full production-ready C# code for Unity with clear Russian comments.",
            },
            guide: {
              type: Type.STRING,
              description: "Detailed, step-by-step Unity integration guide in Russian. Format with clear Markdown headings, lists, and bold text.",
            },
            gameVariables: {
              type: Type.OBJECT,
              properties: {
                doubleJumpEnabled: { type: Type.BOOLEAN },
                jumpForce: { type: Type.NUMBER },
                gravityScale: { type: Type.NUMBER },
                dashEnabled: { type: Type.BOOLEAN },
                maxSpeed: { type: Type.NUMBER },
                collectibleValue: { type: Type.NUMBER },
                particlesDensity: { type: Type.NUMBER },
                bounceForce: { type: Type.NUMBER },
                playerColor: { type: Type.STRING },
                cameraShakeEnabled: { type: Type.BOOLEAN },
                activeScriptComponent: { type: Type.STRING },
              },
              description: "Updated physical/visual variables to apply to the Web preview game.",
            },
            summary: {
              type: Type.STRING,
              description: "A friendly and brief 2-3 sentence Russian summary of the new mechanic.",
            },
          },
          required: ["code", "guide", "summary"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No text returned from Gemini API");
    }

    const result = JSON.parse(responseText.trim());
    res.json(result);
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate Unity script" });
  }
});

// Fallback script definitions if Gemini is offline/API key missing
function getFallbackResponse(prompt: string, activeComponent: string) {
  const p = prompt.toLowerCase();
  
  if (p.includes("двойн") || p.includes("double jump")) {
    return {
      code: `using UnityEngine;

public class PlayerController : MonoBehaviour
{
    [Header("Movement Settings")]
    public float moveSpeed = 8f;
    public float jumpForce = 12f;
    public Transform groundCheck;
    public LayerMask groundLayer;

    [Header("Double Jump")]
    public bool canDoubleJump = true;
    private bool isGrounded;
    private int extraJumpsRemaining;
    public int maxExtraJumps = 1;

    private Rigidbody2D rb;
    private float horizontalInput;

    void Start()
    {
        rb = GetComponent<Rigidbody2D>();
    }

    void Update()
    {
        // Получение ввода
        horizontalInput = Input.GetAxisRaw("Horizontal");

        // Проверка приземления с помощью небольшого оверлапа
        isGrounded = Physics2D.OverlapCircle(groundCheck.position, 0.2f, groundLayer);

        if (isGrounded)
        {
            extraJumpsRemaining = maxExtraJumps;
        }

        // Логика прыжка
        if (Input.GetButtonDown("Jump"))
        {
            if (isGrounded)
            {
                Jump();
            }
            else if (extraJumpsRemaining > 0 && canDoubleJump)
            {
                Jump();
                extraJumpsRemaining--;
                CreateJumpParticles(); // Эффект Hollow Knight
            }
        }
    }

    void FixedUpdate()
    {
        // Горизонтальное движение
        rb.linearVelocity = new Vector2(horizontalInput * moveSpeed, rb.linearVelocity.y);
    }

    void Jump()
    {
        rb.linearVelocity = new Vector2(rb.linearVelocity.x, jumpForce);
    }

    void CreateJumpParticles()
    {
        // Метод для создания красивых частиц пыли под ногами
    }
}`,
      guide: `### Пошаговое руководство по настройке Двойного Прыжка в Unity:

1. **Создайте объект Игрока**:
   - Создайте 2D Спрайт в Unity (например, Capsule или Square), назовите его **Player**.
   - Добавьте ему компонент **Rigidbody2D** и установите **Collision Detection** в *Continuous*, а также заблокируйте вращение по оси Z (*Freeze Rotation Z*).
   - Добавьте компонент **BoxCollider2D** или **CapsuleCollider2D**.

2. **Создайте GroundCheck**:
   - Внутри объекта Player создайте пустой дочерний объект и назовите его **GroundCheck**. Перетащите его в самый низ спрайта игрока.

3. **Слои и теги**:
   - Создайте слой (Layer) под названием **Ground** и назначьте его всем вашим платформам.
   - Назначьте игроку тег **Player**.

4. **Добавление скрипта**:
   - Создайте новый C# скрипт в Unity, назовите его \`PlayerController\`.
   - Скопируйте данный код в файл скрипта.
   - Перетащите скрипт на объект **Player**.
   - В инспекторе перетащите дочерний объект \`GroundCheck\` в поле **Ground Check**, а в поле **Ground Layer** выберите созданный слой *Ground*.

5. **Готово!** Запустите игру и прыгайте клавишей Пробел. Повторное нажатие в воздухе выполнит изящный двойной прыжок.`,
      gameVariables: {
        doubleJumpEnabled: true,
        jumpForce: 12.5,
        gravityScale: 2.3,
        playerColor: "#a855f7",
        activeScriptComponent: "PlayerController"
      },
      summary: "Скрипт добавляет полноценный двойной прыжок для игрока с проверкой приземления через физический круг OverlapCircle. В веб-демо теперь также включен двойной прыжок!"
    };
  }

  if (p.includes("рывок") || p.includes("дэш") || p.includes("dash")) {
    return {
      code: `using System.Collections;
using UnityEngine;

public class PlayerController : MonoBehaviour
{
    [Header("Movement")]
    public float moveSpeed = 8f;
    private Rigidbody2D rb;

    [Header("Dash settings")]
    public bool canDash = true;
    public float dashForce = 20f;
    public float dashDuration = 0.15f;
    public float dashCooldown = 1f;
    private bool isDashing;
    private float dashCooldownTimer;

    void Start()
    {
        rb = GetComponent<Rigidbody2D>();
    }

    void Update()
    {
        if (isDashing) return;

        float horizontal = Input.GetAxisRaw("Horizontal");

        if (dashCooldownTimer > 0)
            dashCooldownTimer -= Time.deltaTime;

        if (Input.GetKeyDown(KeyCode.LeftShift) && canDash && dashCooldownTimer <= 0)
        {
            StartCoroutine(PerformDash(horizontal));
        }
    }

    private IEnumerator PerformDash(float direction)
    {
        isDashing = true;
        dashCooldownTimer = dashCooldown;
        
        // Отключаем гравитацию на время рывка
        float originalGravity = rb.gravityScale;
        rb.gravityScale = 0f;

        // Если игрок не нажимает кнопки, рывок делается по направлению взгляда
        float dashDir = direction != 0 ? Mathf.Sign(direction) : transform.localScale.x;
        rb.linearVelocity = new Vector2(dashDir * dashForce, 0f);

        // Спавн призрачного шлейфа (Ghost Trail)
        SpawnGhostTrail();

        yield return new WaitForSeconds(dashDuration);

        rb.gravityScale = originalGravity;
        isDashing = false;
    }

    void SpawnGhostTrail() { /* Эффект Hollow Knight шлейфа */ }
}`,
      guide: `### Пошаговое руководство по настройке Рывка (Dash) в Unity:

1. **Добавление кода**:
   - Откройте ваш скрипт \`PlayerController\` и добавьте поля для рывка и Корутину \`PerformDash\`.

2. **Клавиша активации**:
   - По умолчанию используется клавиша **Left Shift**. В Unity вы можете настроить её через Input Manager или использовать прямой код \`Input.GetKeyDown(KeyCode.LeftShift)\`.

3. **Настройка физики во время рывка**:
   - Корутина временно сбрасывает силу гравитации (\`rb.gravityScale = 0f\`) для того, чтобы рывок происходил ровно горизонтально, без падения вниз, в точности как в Hollow Knight.

4. **Эффект шлейфа (Ghost Trail)**:
   - Для создания атмосферного эффекта, вы можете инстанцировать полупрозрачные копии спрайта игрока по ходу рывка и плавно их растворять через альфа-канал спрайта.`,
      gameVariables: {
        dashEnabled: true,
        maxSpeed: 6.5,
        playerColor: "#06b6d4",
        cameraShakeEnabled: true,
        activeScriptComponent: "PlayerController"
      },
      summary: "Код реализует классический горизонтальный рывок (дэш) с временным отключением гравитации. В веб-демо теперь разблокирован супер-быстрый рывок на Shift!"
    };
  }

  // Default fallback (custom or platform code)
  return {
    code: `using UnityEngine;

public class MovingPlatform : MonoBehaviour
{
    [Header("Platform Settings")]
    public Transform pointA;
    public Transform pointB;
    public float speed = 3f;
    
    private Vector3 targetPosition;

    void Start()
    {
        targetPosition = pointB.position;
    }

    void Update()
    {
        // Движение платформы к цели
        transform.position = Vector3.MoveTowards(transform.position, targetPosition, speed * Time.deltaTime);

        // Переключение цели при достижении
        if (Vector3.Distance(transform.position, targetPosition) < 0.1f)
        {
            targetPosition = targetPosition == pointA.position ? pointB.position : pointA.position;
        }
    }

    // Игрок становится дочерним объектом платформы при приземлении, чтобы не соскальзывать
    private void OnCollisionEnter2D(Collision2D collision)
    {
        if (collision.gameObject.CompareTag("Player"))
        {
            collision.transform.SetParent(transform);
        }
    }

    private void OnCollisionExit2D(Collision2D collision)
    {
        if (collision.gameObject.CompareTag("Player"))
        {
            collision.transform.SetParent(null);
        }
    }
}`,
    guide: `### Пошаговое руководство по созданию движущихся платформ в Unity:

1. **Создайте платформу**:
   - Создайте 2D спрайт платформы (вытянутый прямоугольник), добавьте **BoxCollider2D**.
   - Назовите объект **MovingPlatform**.

2. **Точки маршрута (Point A и Point B)**:
   - Внутри платформы (или рядом) создайте два пустых GameObject. Назовите их **PointA** и **PointB**.
   - Разместите их в пространстве там, где платформа должна начинать движение и разворачиваться.
   - Важно: вытащите их из дочерних элементов платформы в корень сцены, чтобы они не двигались вместе с ней!

3. **Привязка скрипта**:
   - Назначьте скрипт \`MovingPlatform\` на объект платформы.
   - В инспекторе перетащите ваши объекты \`PointA\` и \`PointB\` в соответствующие слоты.

4. **Родительская связь**:
   - В коде используются методы \`OnCollisionEnter2D\` и \`OnCollisionExit2D\`. Это важнейший прием в Unity, чтобы игрок двигался вместе с платформой синхронно, не соскальзывая с неё.`,
    gameVariables: {
      bounceForce: 16,
      particlesDensity: 1.5,
      activeScriptComponent: "MovingPlatform"
    },
    summary: "Этот скрипт заставляет платформу перемещаться между двумя точками и корректно удерживать игрока на своей поверхности с помощью родительской связи."
  };
}

// Vite middleware and static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer();
