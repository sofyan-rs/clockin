# ClockIn Code Structure

Version 1.0 · 11 Oct 2026 · Read with [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`CONTRIBUTION.md`](CONTRIBUTION.md)

Goal: **standard best practice that a junior developer can read on day one.** If you're not sure where something goes, this doc should answer it. If it doesn't, ask and then add the answer here.

---

## 1. Rules for all apps

| # | Rule | Why |
|---|---|---|
| 1 | **Folders by feature, not by file type.** Everything about employees lives under `employees/` | You open one folder and see the whole feature |
| 2 | **Three layers, always the same:** entry point (controller / page / screen) → logic (service / composable / ViewModel) → data (Prisma / API client / repository) | Same mental model in every app |
| 3 | **Business rules are plain functions** in a `rules/` folder: no framework, no database, no HTTP. Example: `calculateLateMinutes()`, `isInsideGeofence()` | Easy to read, easy to unit test |
| 4 | **Be explicit.** No generic base classes, no "magic" decorators of our own, no metaprogramming. Copy a small pattern rather than abstract it too early (abstract on the third copy) | Juniors can follow the code by reading it top to bottom |
| 5 | **Name things after the domain** (PRD words): `clockIn`, `attendanceDay`, `needsReview`, `scheduleFor(date)`. Never `data`, `info`, `manager`, `helper`, `utils2` | Code reads like the PRD |
| 6 | **Small units.** File ≲ 300 lines, function ≲ 40 lines, max 3 levels of nesting. Use early returns | Fits on one screen |
| 7 | **Comments say why, not what.** Link the rule: `// PRD §9.1: late counts from start time, not from end of tolerance` | The why is what gets lost |
| 8 | **Types at the edges.** DTOs / zod schemas / `@Serializable` classes validate everything that comes in; inside, trust the types | Bugs stop at the door |
| 9 | **One way to do each thing** (errors, dates, API calls, forms). The pattern is shown below; follow it | Less to learn |
| 10 | **Tests sit next to the code** (`*.spec.ts`, `*Test.kt`), e2e tests in their own folder | Easy to find, easy to keep updated |

Naming:

| Thing | TypeScript | Kotlin |
|---|---|---|
| Files | `kebab-case.ts` (`clock-in.dto.ts`), Vue components `PascalCase.vue` | `PascalCase.kt` (one main class per file) |
| Types / classes | `PascalCase` | `PascalCase` |
| Functions / variables | `camelCase`, verbs for functions (`findEmployee`) | `camelCase` |
| Constants / enums | `UPPER_SNAKE` for constants, enum values match API (`ON_TIME`) | `UPPER_SNAKE` enum entries |
| Booleans | `isActive`, `hasSelfie`, `canApprove` | same |

---

## 2. Backend (`apps/api`, NestJS)

### 2.1 Folder layout

```
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts                     HTTP entry
│   ├── worker.ts                   Jobs entry (no HTTP)
│   ├── app.module.ts
│   ├── config/
│   │   └── env.ts                  zod schema for env vars → typed `env`
│   ├── common/                     shared by every module; nothing feature-specific
│   │   ├── auth/                   guards, @CurrentUser(), @Permission(), scope.service.ts
│   │   ├── errors/                 app-error.ts, error-codes.ts, problem-details.filter.ts
│   │   ├── prisma/                 prisma.service.ts (+ tenancy extension)
│   │   ├── tenancy/                tenant-context.ts
│   │   └── time/                   time.ts (UTC ↔ office time zone helpers)
│   └── modules/
│       ├── attendance/             ← example feature, every module looks like this
│       │   ├── attendance.module.ts
│       │   ├── attendance.controller.ts          mobile routes (/v1/attendance, /v1/me/today)
│       │   ├── attendance-admin.controller.ts    admin routes (/v1/admin/review, …)
│       │   ├── attendance.service.ts             use cases: clockIn, clockOut, sync
│       │   ├── attendance-day.service.ts         recompute daily rollup
│       │   ├── rules/                            pure functions + their tests
│       │   │   ├── geofence.ts
│       │   │   ├── geofence.spec.ts
│       │   │   ├── attendance-status.ts
│       │   │   └── attendance-status.spec.ts
│       │   ├── dto/
│       │   │   ├── clock-in.request.ts
│       │   │   └── clock-in.response.ts
│       │   └── attendance.service.spec.ts
│       ├── auth/
│       ├── employees/
│       └── …
└── test/
    ├── e2e/                        attendance.e2e-spec.ts, …
    ├── factories/                  createEmployee(), createLocation() for tests
    └── setup.ts                    Testcontainers bootstrap
```

### 2.2 What goes where

| Layer | File | Does | Doesn't |
|---|---|---|---|
| Controller | `*.controller.ts` | Route, guards, read DTO, call **one** service method, return response DTO | Business logic, Prisma calls, try/catch |
| Service | `*.service.ts` | One public method per use case; loads data with Prisma, calls rules, writes in a transaction, writes audit | HTTP details (status codes, headers) |
| Rules | `rules/*.ts` | Pure calculations and decisions | Import Nest, Prisma or anything with I/O |
| DTO | `dto/*.request.ts`, `*.response.ts` | Shape + validation + Swagger docs | Logic |

A separate repository layer is **not** used: Prisma is already a typed data layer. If a query is reused in 3+ places, move it to a named method on the service (e.g. `findActiveEmployee(id)`).

### 2.3 Example (the pattern to copy)

```ts
// modules/attendance/dto/clock-in.request.ts
export class ClockInRequest {
  @ApiProperty({ enum: WorkMode }) @IsEnum(WorkMode) mode!: WorkMode;
  @ApiProperty() @IsLatitude() lat!: number;
  @ApiProperty() @IsLongitude() lng!: number;
  @ApiProperty() @IsNumber() @Min(0) accuracy!: number;
  @ApiProperty() @IsBoolean() isMock!: boolean;
  @ApiProperty() @IsString() selfieKey!: string;
  @ApiProperty() @IsBoolean() faceDetected!: boolean;
  @ApiProperty() @IsISO8601() deviceTime!: string;
}
```

```ts
// modules/attendance/attendance.controller.ts
@ApiTags('attendance')
@UseGuards(MobileAuthGuard)
@Controller('v1/attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('clock-in')
  clockIn(
    @CurrentEmployee() employee: AuthEmployee,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: ClockInRequest,
  ): Promise<ClockInResponse> {
    return this.attendance.clockIn(employee, body, idempotencyKey);
  }
}
```

```ts
// modules/attendance/attendance.service.ts (excerpt)
async clockIn(employee: AuthEmployee, input: ClockInRequest, idempotencyKey: string) {
  const settings = await this.settings.forCompany(employee.companyId);
  const office = await this.locations.getForEmployee(employee.id);

  if (input.isMock && settings.blockFakeGps) {
    throw new AppError(ErrorCode.MOCK_LOCATION);
  }

  const geofence = checkGeofence(office, input);          // pure rule
  if (input.mode === 'WFO' && !geofence.isInside) {
    throw new AppError(ErrorCode.OUTSIDE_GEOFENCE, { distanceM: geofence.distanceM });
  }
  // … weak GPS, selfie check, flags (see ARCHITECTURE §7.2), then save in a transaction
}
```

```ts
// modules/attendance/rules/geofence.ts
/** PRD §9.1: valid when distance ≤ radius AND accuracy ≤ max accuracy. */
export function checkGeofence(office: Geofence, point: GpsPoint): GeofenceResult {
  const distanceM = haversineMeters(office, point);
  return {
    distanceM,
    isInside: distanceM <= office.radiusM,
    isAccurateEnough: point.accuracy <= office.maxAccuracyM,
  };
}
```

### 2.4 Errors

- Throw `new AppError(ErrorCode.X, details?)`. `ErrorCode` is one enum in `common/errors/error-codes.ts` with the HTTP status next to each code.
- The global filter turns it into problem+json. Never `throw new HttpException(...)` with a free-text message.
- Unexpected errors bubble up; the filter logs them and returns a generic 500.

---

## 3. Web admin (`apps/admin`, Nuxt 4)

### 3.1 Folder layout

```
apps/admin/
├── app/
│   ├── app.vue, app.config.ts
│   ├── assets/css/main.css         design tokens (DESIGN_SYSTEM §5)
│   ├── layouts/
│   │   ├── auth.vue                sign-in pages
│   │   └── dashboard.vue           sidebar shell
│   ├── middleware/auth.global.ts
│   ├── pages/                      one file per route (SCREENS.md "Route" column)
│   │   ├── index.vue               W02 Dashboard
│   │   ├── login.vue
│   │   └── employees/
│   │       ├── index.vue           W03
│   │       ├── new.vue             W04a
│   │       ├── import.vue          W03b
│   │       └── [id].vue            W04
│   ├── components/
│   │   ├── common/                 AttendanceStatusBadge.vue, StatTile.vue, EmptyState.vue, ConfirmDialog.vue, PageHeader.vue
│   │   └── employees/              EmployeeTable.vue, EmployeeForm.vue, DeactivateEmployeeModal.vue
│   ├── composables/
│   │   ├── useApi.ts               typed client (one place for fetch, errors, toasts)
│   │   └── useEmployees.ts         list/get/create/update for one feature
│   ├── stores/                     Pinia, global state only
│   │   └── session.ts              current admin, permissions, feature flags
│   ├── schemas/employee.ts         zod schemas for forms
│   └── utils/format.ts             formatDate(), formatTime(), formatTz()
├── server/                         Nitro BFF (runs on the server, not in the browser)
│   ├── api/auth/sign-in.post.ts, sign-out.post.ts, refresh.post.ts
│   ├── api/[...].ts                proxy to the NestJS API
│   └── utils/session-cookies.ts
└── i18n/locales/en.json
```

### 3.2 What goes where

| Layer | Where | Does | Doesn't |
|---|---|---|---|
| Page | `pages/**.vue` | Read route/query, call a feature composable, pass data to components, handle navigation | Raw API calls, big templates (split into components) |
| Component | `components/<feature>/*.vue` | Show props, emit events; local UI state only (open/closed, input values) | Call the API or the router |
| Composable | `composables/use<Feature>.ts` | All API calls for a feature, loading/error state, refresh | Render anything |
| Store | `stores/*.ts` | Data many pages need for the whole session (who am I, permissions, flags) | Per-page data (use composables) |
| Schema | `schemas/*.ts` | zod validation for forms, reused in `UForm` | — |

Vue rules: `<script setup lang="ts">` and Composition API only; typed `defineProps` / `defineEmits`; block order script → template → style; Nuxt UI components and theme tokens (no raw hex); all text through `$t()`.

### 3.3 Example

```ts
// composables/useEmployees.ts
export function useEmployees(query: Ref<EmployeeListQuery>) {
  const api = useApi();
  const { data, status, refresh } = useAsyncData(
    'employees',
    () => api.get('/v1/admin/employees', { query: query.value }),
    { watch: [query] },
  );
  return { employees: computed(() => data.value?.items ?? []), total: computed(() => data.value?.total ?? 0), status, refresh };
}
```

```vue
<!-- pages/employees/index.vue -->
<script setup lang="ts">
const query = useRouteQuery<EmployeeListQuery>({ page: 1, pageSize: 25 }); // filters live in the URL
const { employees, total, status } = useEmployees(query);
</script>

<template>
  <PageHeader :title="$t('employees.title')">
    <template #actions>
      <UButton to="/employees/import" variant="outline" color="neutral" icon="i-tabler-upload">{{ $t('employees.import') }}</UButton>
      <UButton to="/employees/new" icon="i-tabler-user-plus">{{ $t('employees.add') }}</UButton>
    </template>
  </PageHeader>
  <EmptyState v-if="status === 'success' && total === 0" icon="i-tabler-users" :title="$t('employees.empty.title')" />
  <EmployeeTable v-else v-model:query="query" :rows="employees" :total="total" :loading="status === 'pending'" />
</template>
```

---

## 4. Mobile (`apps/mobile`, Kotlin Multiplatform, Android first)

Android ships first; iOS comes later (PLAN Stage 5). The project is **Kotlin Multiplatform from day one with only the Android target enabled**, so almost all code is already shared when iOS is added. Phone features (GPS, camera, secure storage…) sit behind plain Kotlin **interfaces** in common code, with Android implementations injected by Koin. Adding iOS = writing iOS implementations of those interfaces + the Xcode host app.

### 4.1 Pattern: MVVM

The mobile app uses **MVVM (Model–View–ViewModel)** with one-way data flow:

```
 View (Compose Screen)  ──user action──▶  ViewModel  ──calls──▶  Model (Repository → Api / Database)
        ▲                                     │
        └──────── StateFlow<UiState> ◀────────┘   (+ one-off Effects: navigate, show snackbar)
```

| MVVM part | In this project | Files |
|---|---|---|
| **View** | Compose screens. Draw the `UiState`, forward clicks to the ViewModel. No logic | `feature/<x>/ui/XxxScreen.kt` |
| **ViewModel** | Holds and updates screen state, one function per user action, survives rotation | `feature/<x>/ui/XxxViewModel.kt`, `XxxUiState.kt` |
| **Model** | Data and business logic: repositories, API, local DB, app models, use cases for multi-step flows | `feature/<x>/data/`, `feature/<x>/domain/`, `core/` |

Rules: the View never talks to the Model directly; the ViewModel never imports Android/Compose UI classes; state only flows down (`UiState`), events only flow up (function calls). One ViewModel per screen.

### 4.2 Folder layout

One Gradle module (`composeApp`) is enough for this app size; split into modules only when build time hurts.

```
apps/mobile/
├── composeApp/
│   └── src/
│       ├── commonMain/kotlin/com/sasanadigital/clockin/
│       │   ├── App.kt                       root composable (theme + navigation)
│       │   ├── di/                          AppModule.kt (Koin), PlatformModule.kt (expect)
│       │   ├── navigation/                  AppNavHost.kt, Routes.kt (type-safe routes)
│       │   ├── core/
│       │   │   ├── designsystem/            theme/ (Color, Type, Shape, Theme.kt), components/ (PrimaryButton, StatusBadge, …)
│       │   │   ├── network/                 ApiClient.kt, ApiError.kt, ServerClock.kt, AuthTokenStore.kt
│       │   │   ├── database/                SQLDelight setup
│       │   │   ├── platform/                INTERFACES only: LocationProvider, SelfieCamera, FaceDetector, SecureStorage, BiometricPrompt, DeviceIdProvider, MonotonicClock, ConnectivityMonitor
│       │   │   └── model/                   shared enums: AttendanceStatus, WorkMode
│       │   └── feature/
│       │       ├── auth/                    ← example feature, every feature looks like this
│       │       │   ├── data/
│       │       │   │   ├── AuthApi.kt       Ktor calls
│       │       │   │   ├── AuthRepository.kt
│       │       │   │   └── dto/SignInRequest.kt, SignInResponse.kt
│       │       │   └── ui/
│       │       │       ├── LoginScreen.kt   stateless UI
│       │       │       ├── LoginViewModel.kt
│       │       │       └── LoginUiState.kt
│       │       ├── home/                    + domain/ClockInUseCase.kt (multi-step flow)
│       │       ├── attendance/              selfie, confirmation, offline queue
│       │       ├── history/
│       │       └── profile/
│       ├── commonMain/sqldelight/…          .sq files (offline queue, cache)
│       ├── commonTest/kotlin/…              ViewModel, use case, rules tests
│       ├── androidMain/kotlin/com/sasanadigital/clockin/
│       │   ├── MainActivity.kt
│       │   ├── ClockInApplication.kt        starts Koin
│       │   └── platform/                    AndroidLocationProvider.kt (FusedLocation), CameraXSelfieCamera.kt, MlKitFaceDetector.kt, AndroidSecureStorage.kt, …
│       └── iosMain/                         (added in Stage 5) IosLocationProvider.kt, …
├── iosApp/                                  (added in Stage 5) Xcode host app
└── gradle/libs.versions.toml                every dependency version in one place
```

### 4.3 What goes where (MVVM layers)

| Layer | Where | Does | Doesn't |
|---|---|---|---|
| View: Screen | `ui/XxxScreen.kt` | Draw `UiState`, call lambdas on clicks. Has `@Preview`. Gets no ViewModel | Business logic, API calls |
| View: Route | top of `XxxScreen.kt` (`XxxRoute`) | Gets ViewModel from Koin, collects state, connects lambdas, handles navigation effects | — |
| ViewModel | `ui/XxxViewModel.kt` | Holds `StateFlow<XxxUiState>`, one public function per user action (`onClockInClick()`), one-off effects via `Channel` | Android imports (`Context`, etc.) |
| Model: use case | `domain/XxxUseCase.kt` | Only for flows with several steps or shared by screens (clock-in: location → selfie upload → API → queue if offline) | Single-call wrappers (call the repository directly) |
| Model: repository | `data/XxxRepository.kt` | Combine API + local DB, map DTO → app model, map errors to `ApiError` | UI state |
| Model: platform interface | `core/platform/` | Describe a phone capability in plain Kotlin | Android/iOS types |
| Model: platform impl | `androidMain/platform/` | Implement it with Android APIs | Business rules |

### 4.4 Example

```kotlin
// feature/auth/ui/LoginUiState.kt
data class LoginUiState(
    val login: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: LoginError? = null,
)

// feature/auth/ui/LoginViewModel.kt
class LoginViewModel(private val auth: AuthRepository) : ViewModel() {
    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    private val _effects = Channel<LoginEffect>()
    val effects = _effects.receiveAsFlow()

    fun onLoginChange(value: String) = _state.update { it.copy(login = value, error = null) }
    fun onPasswordChange(value: String) = _state.update { it.copy(password = value, error = null) }

    fun onSignInClick() = viewModelScope.launch {
        _state.update { it.copy(isLoading = true) }
        when (val result = auth.signIn(state.value.login, state.value.password)) {
            is SignInResult.Success -> _effects.send(LoginEffect.GoToNextStep(result.nextStep))
            is SignInResult.DeviceNotRecognized -> _effects.send(LoginEffect.GoToDeviceNotRecognized)
            is SignInResult.Failed -> _state.update { it.copy(error = result.error) }
        }
        _state.update { it.copy(isLoading = false) }
    }
}

// feature/auth/ui/LoginScreen.kt
@Composable
fun LoginRoute(onNavigate: (LoginEffect) -> Unit, viewModel: LoginViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.effects.collect(onNavigate) }
    LoginScreen(state, viewModel::onLoginChange, viewModel::onPasswordChange, viewModel::onSignInClick)
}

@Composable
fun LoginScreen(
    state: LoginUiState,
    onLoginChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSignInClick: () -> Unit,
) { /* M02 layout using core/designsystem components */ }
```

```kotlin
// core/platform/LocationProvider.kt (commonMain)
interface LocationProvider {
    /** Returns one fix or null on timeout. isMock is always false where the OS can't tell (iOS). */
    suspend fun currentLocation(timeoutMs: Long = 10_000): GpsFix?
}
data class GpsFix(val lat: Double, val lng: Double, val accuracyM: Float, val isMock: Boolean)

// androidMain/platform/AndroidLocationProvider.kt
class AndroidLocationProvider(private val context: Context) : LocationProvider {
    override suspend fun currentLocation(timeoutMs: Long): GpsFix? { /* FusedLocationProviderClient */ }
}

// di/PlatformModule.kt
expect val platformModule: Module          // the only expect/actual in the app
// androidMain: actual val platformModule = module { single<LocationProvider> { AndroidLocationProvider(get()) } … }
```

Home screen states (ARCHITECTURE §11) are a `sealed interface HomeStatus` inside `HomeUiState`, so `when (status)` in the screen must handle every case; the compiler catches a missing state.

---

## 5. Where do I put…?

| I need to… | Put it in |
|---|---|
| Add an API endpoint | `apps/api/src/modules/<feature>/<feature>.controller.ts` (+ DTOs in `dto/`), logic in the service, then `bun run --filter api openapi:emit` |
| Add a business rule (calculation/decision) | `modules/<feature>/rules/<rule>.ts` + `.spec.ts` |
| Add a DB column/table | `prisma/schema.prisma` → `bun run --filter api prisma:migrate --name <desc>` |
| Add a background job | `modules/jobs/processors/<job>.processor.ts`, schedule in `jobs.module.ts` |
| Add an error code | `common/errors/error-codes.ts` + translation in admin `en.json` and mobile strings |
| Add a web page | `apps/admin/app/pages/…` matching the SCREENS.md route |
| Reuse UI across web pages | `components/common/` (generic) or `components/<feature>/` |
| Call a new API from the web | Method in `composables/use<Feature>.ts` |
| Add a mobile screen | `feature/<feature>/ui/` (Screen + ViewModel + UiState) + route in `navigation/Routes.kt` |
| Use a new phone capability | Interface in `core/platform/`, Android impl in `androidMain/platform/`, bind in `platformModule` |
| Add a color, font size or spacing | Design tokens only (`main.css` / `core/designsystem/theme`), from DESIGN_SYSTEM.md |

## 6. Lint and format (enforced in CI)

| App | Tooling |
|---|---|
| API + admin | ESLint (flat config from `packages/eslint-config`: typescript-eslint strict, import order, `vue` plugin for admin) + Prettier |
| Mobile | ktlint (via Spotless) + detekt with default rules; Android Lint |

Set your editor to format on save; CI rejects unformatted code.
