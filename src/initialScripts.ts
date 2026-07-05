import { CSharpScript } from "./types";

export const initialScripts: { [key: string]: CSharpScript } = {
  PlayerController: {
    code: `using UnityEngine;
using System.Collections;

public class PlayerController : MonoBehaviour
{
    [Header("Движение")]
    [SerializeField] private float moveSpeed = 8f;
    [SerializeField] private float jumpForce = 12f;
    [SerializeField] private float gravityScale = 2.2f;

    [Header("Двойной прыжок")]
    [SerializeField] private bool canDoubleJump = true;
    private bool isGrounded;
    private int extraJumpsRemaining;
    private int maxExtraJumps = 1;

    [Header("Рывок (Dash)")]
    [SerializeField] private bool canDash = true;
    [SerializeField] private float dashForce = 20f;
    [SerializeField] private float dashDuration = 0.15f;
    [SerializeField] private float dashCooldown = 1f;
    private bool isDashing;
    private float dashCooldownTimer;

    [Header("Слои и Окружение")]
    [SerializeField] private Transform groundCheck;
    [SerializeField] private LayerMask groundLayer;

    private Rigidbody2D rb;
    private float horizontalInput;
    private int facingDirection = 1; // 1 = вправо, -1 = влево

    void Start()
    {
        rb = GetComponent<Rigidbody2D>();
        rb.gravityScale = gravityScale;
    }

    void Update()
    {
        if (isDashing) return;

        // Считывание ввода
        horizontalInput = Input.GetAxisRaw("Horizontal");
        
        if (horizontalInput != 0)
        {
            facingDirection = (int)Mathf.Sign(horizontalInput);
            // Поворот спрайта
            transform.localScale = new Vector3(facingDirection, 1, 1);
        }

        // Физическая проверка касания земли
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
                CreateDoubleJumpParticles();
            }
        }

        // Логика рывка (Left Shift)
        if (dashCooldownTimer > 0)
            dashCooldownTimer -= Time.deltaTime;

        if (Input.GetKeyDown(KeyCode.LeftShift) && canDash && dashCooldownTimer <= 0)
        {
            StartCoroutine(PerformDash());
        }
    }

    void FixedUpdate()
    {
        if (isDashing) return;

        // Применяем горизонтальную скорость
        rb.linearVelocity = new Vector2(horizontalInput * moveSpeed, rb.linearVelocity.y);
    }

    private void Jump()
    {
        rb.linearVelocity = new Vector2(rb.linearVelocity.x, jumpForce);
        CreateJumpParticles();
    }

    private IEnumerator PerformDash()
    {
        isDashing = true;
        dashCooldownTimer = dashCooldown;

        float originalGravity = rb.gravityScale;
        rb.gravityScale = 0f;

        // Делаем рывок в направлении горизонтального ввода или взгляда
        float dashDir = horizontalInput != 0 ? Mathf.Sign(horizontalInput) : facingDirection;
        rb.linearVelocity = new Vector2(dashDir * dashForce, 0f);

        yield return new WaitForSeconds(dashDuration);

        rb.gravityScale = originalGravity;
        isDashing = false;
    }

    private void CreateJumpParticles() { /* Код спавна пыли */ }
    private void CreateDoubleJumpParticles() { /* Код спавна эффекта душ */ }
}`,
    guide: `### Пошаговое руководство по настройке Player в Unity

1. **Создайте Game Object**:
   - Перейдите в меню \`GameObject -> 2D Object -> Sprites -> Capsule\` (или используйте свой спрайт рыцаря). Назовите его **Player**.

2. **Добавьте Физику (Rigidbody 2D)**:
   - Выберите объект **Player** в окне Hierarchy.
   - Нажмите \`Add Component -> Rigidbody 2D\`.
   - В инспекторе в поле **Collision Detection** выберите **Continuous** (чтобы предотвратить прохождение сквозь платформы).
   - Раскройте меню **Constraints** и отметьте **Freeze Rotation Z** (чтобы рыцарь не вращался и не падал при ходьбе).
   - Установите **Gravity Scale** равным \`2.2\`.

3. **Добавьте Коллайдер**:
   - Нажмите \`Add Component -> Capsule Collider 2D\`. Отрегулируйте его размер под пропорции вашего спрайта.

4. **Создайте индикатор касания земли (Ground Check)**:
   - Кликните правой кнопкой мыши по объекту **Player** -> \`Create Empty\`. Назовите дочерний объект **GroundCheck**.
   - В окне Scene переместите этот объект к самым ногам спрайта (чуть ниже нижнего края коллайдера).

5. **Создайте слои и прикрепите скрипт**:
   - В правом верхнем углу инспектора нажмите \`Layer -> Add Layer\`. Создайте слой под названием **Ground**.
   - Назначьте слой **Ground** всем объектам ваших платформ.
   - Нажмите \`Add Component\` на объекте **Player**, найдите созданный C# скрипт \`PlayerController\`.
   - Перетащите ваш дочерний объект \`GroundCheck\` в соответствующее поле скрипта в инспекторе.
   - В поле **Ground Layer** выберите слой \`Ground\`.`,
    summary: "Скрипт PlayerController.cs отвечает за продвинутое перемещение Рыцаря. Включает плавную смену направления, прыжки, проверку земли с помощью OverlapCircle, двойной прыжок и горизонтальный рывок (дэш) с временным замораживанием гравитации для идеальной физики.",
    gameVariables: {
      doubleJumpEnabled: true,
      dashEnabled: true,
      maxSpeed: 5,
      jumpForce: 12,
      gravityScale: 2.2,
      playerColor: "#ffffff",
    },
  },

  MovingPlatform: {
    code: `using UnityEngine;

public class MovingPlatform : MonoBehaviour
{
    [Header("Настройки Платформы")]
    [SerializeField] private Transform pointA;
    [SerializeField] private Transform pointB;
    [SerializeField] private float speed = 3f;
    [SerializeField] private bool isSpring = false;
    [SerializeField] private float springBounceForce = 15f;

    private Vector3 targetPosition;

    void Start()
    {
        targetPosition = pointB.position;
    }

    void Update()
    {
        if (pointA == null || pointB == null) return;

        // Плавное движение платформы к текущей цели
        transform.position = Vector3.MoveTowards(transform.position, targetPosition, speed * Time.deltaTime);

        // Переключение целевой точки при приближении
        if (Vector3.Distance(transform.position, targetPosition) < 0.1f)
        {
            targetPosition = targetPosition == pointA.position ? pointB.position : pointA.position;
        }
    }

    // Привязка Игрока к Платформе для предотвращения соскальзывания
    private void OnCollisionEnter2D(Collision2D collision)
    {
        if (collision.gameObject.CompareTag("Player"))
        {
            // Проверка: прыгнул ли игрок сверху на пружину
            if (isSpring && collision.relativeVelocity.y <= 0.1f)
            {
                Rigidbody2D playerRb = collision.gameObject.GetComponent<Rigidbody2D>();
                if (playerRb != null)
                {
                    playerRb.linearVelocity = new Vector2(playerRb.linearVelocity.x, springBounceForce);
                    PlaySpringAnimation();
                }
            }
            else
            {
                // Игрок становится дочерним объектом платформы, чтобы двигаться синхронно
                collision.transform.SetParent(transform);
            }
        }
    }

    private void OnCollisionExit2D(Collision2D collision)
    {
        if (collision.gameObject.CompareTag("Player"))
        {
            // Сбрасываем родительскую связь
            collision.transform.SetParent(null);
        }
    }

    private void PlaySpringAnimation() { /* Визуальный отскок пружины */ }
}`,
    guide: `### Пошаговое руководство по созданию Платформ в Unity

1. **Создайте Платформу**:
   - Меню \`GameObject -> 2D Object -> Sprites -> Square\`. Назовите его **MovingPlatform**.
   - Растяните спрайт по ширине (\`Scale: X=3, Y=0.4, Z=1\`).
   - Нажмите \`Add Component -> BoxCollider2D\`.

2. **Точки перемещения (Waypoints)**:
   - В окне Hierarchy создайте пустой объект \`GameObject -> Create Empty\`. Назовите его **WaypointsContainer**.
   - Внутри него создайте два пустых объекта: **PointA** и **PointB**.
   - В окне Scene разнесите PointA и PointB по горизонтали или вертикали. Это траектория движения вашей платформы.

3. **Слои и Тэги**:
   - Назначьте платформе созданный ранее слой **Ground**.
   - Убедитесь, что Игроку присвоен тэг **Player** (в самом верху инспектора игрока).

4. **Настройка Скрипта**:
   - Прикрепите данный C# скрипт \`MovingPlatform\` к вашей платформе.
   - Перетащите в поля **Point A** и **Point B** соответствующие объекты из сцены.
   - Запустите сцену — платформа будет патрулировать между точками, а игрок сможет легко удерживаться на ней благодаря логике \`SetParent\`.`,
    summary: "Скрипт MovingPlatform.cs реализует движение платформы между двумя точками. Также содержит критически важный механизм OnCollisionEnter2D, который делает игрока дочерним объектом платформы при приземлении, исключая 'проскальзывание' персонажа при движении.",
    gameVariables: {
      bounceForce: 15,
    },
  },

  Collectible: {
    code: `using UnityEngine;

public class CollectibleEssence : MonoBehaviour
{
    [Header("Параметры сбора")]
    [SerializeField] private int scoreValue = 10;
    [SerializeField] private float rotationSpeed = 90f;
    [SerializeField] private float hoverAmplitude = 0.2f;
    [SerializeField] private float hoverFrequency = 2f;

    [Header("Эффекты")]
    [SerializeField] private GameObject collectionEffect;
    [SerializeField] private AudioClip collectSound;

    private Vector3 startPosition;

    void Start()
    {
        startPosition = transform.position;
    }

    void Update()
    {
        // Медленное вращение
        transform.Rotate(Vector3.forward, rotationSpeed * Time.deltaTime);

        // Плавное парение вверх-вниз (Hollow Knight Essence effect)
        float newY = startPosition.y + Mathf.Sin(Time.time * hoverFrequency) * hoverAmplitude;
        transform.position = new Vector3(transform.position.x, newY, transform.position.z);
    }

    private void OnTriggerEnter2D(Collider2D other)
    {
        // Проверка касания коллайдера Игрока
        if (other.CompareTag("Player"))
        {
            Collect();
        }
    }

    private void Collect()
    {
        // Спавн частиц сияния душ
        if (collectionEffect != null)
        {
            Instantiate(collectionEffect, transform.position, Quaternion.identity);
        }

        // Воспроизведение звука
        if (collectSound != null)
        {
            AudioSource.PlayClipAtPoint(collectSound, transform.position);
        }

        // Начисление очков (симуляция добавления в менеджер)
        GameManager.Instance.AddScore(scoreValue);

        // Уничтожение объекта
        Destroy(gameObject);
    }
}`,
    guide: `### Пошаговое руководство по созданию Предметов Сбора (Essence)

1. **Создайте триггер-объект**:
   - Перейдите в \`GameObject -> 2D Object -> Sprites -> Hexagon\` (или любой другой красивый спрайт кристалла/эссенции). Назовите его **CollectibleEssence**.
   - Сделайте его небольшим (\`Scale: 0.4\`).

2. **Настройка Коллайдера-Триггера**:
   - Нажмите \`Add Component -> PolygonCollider2D\` или \`CircleCollider2D\`.
   - **ОБЯЗАТЕЛЬНО** поставьте галочку в чекбоксе **Is Trigger** (это позволит игроку беспрепятственно пробегать сквозь кристалл, регистрируя факт сбора).

3. **Магия Свечения (Glow)**:
   - В Unity для придания Hollow Knight стилистики добавьте дочерний свет: \`Light 2D (Point)\` через Sprite Light (если используете URP 2D Pipeline). Настройте мягкий фиолетовый или золотистый свет.

4. **Прикрепление кода**:
   - Создайте C# скрипт \`CollectibleEssence\`, вставьте данный код и перетащите скрипт на объект эссенции.
   - Настройте ценность предмета в поле **Score Value** в инспекторе.`,
    summary: "Скрипт CollectibleEssence.cs реализует поведение собираемого предмета. Кристалл плавно вращается и парит в воздухе. Метод OnTriggerEnter2D отлавливает соприкосновение с игроком, запускает сбор ресурсов, спавнит эффекты и уничтожает кристалл.",
    gameVariables: {
      collectibleValue: 10,
    },
  },
};
