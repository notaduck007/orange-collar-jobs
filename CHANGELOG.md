## [1.3.5](https://github.com/notaduck007/orange-collar-jobs/compare/v1.3.4...v1.3.5) (2026-06-30)


### Bug Fixes

* **phase4:** enforce job company linkage and restore seeker job navigation ([aeef5eb](https://github.com/notaduck007/orange-collar-jobs/commit/aeef5ebc151d45fe6d6cc5ea702732b9bb91ff5a))

## [1.3.4](https://github.com/notaduck007/orange-collar-jobs/compare/v1.3.3...v1.3.4) (2026-06-25)


### Bug Fixes

* **tests:** integration tests fail repeatedly ([8c10403](https://github.com/notaduck007/orange-collar-jobs/commit/8c10403db72118723ffc149ccd0aa3b92b370b68))

## [1.3.3](https://github.com/notaduck007/orange-collar-jobs/compare/v1.3.2...v1.3.3) (2026-06-25)


### Bug Fixes

* **integration:** tests ([2107747](https://github.com/notaduck007/orange-collar-jobs/commit/21077471bd5478b9c23700cd4429958a477c2964))

## [1.3.2](https://github.com/notaduck007/orange-collar-jobs/compare/v1.3.1...v1.3.2) (2026-06-25)


### Bug Fixes

* **integration:** tests ([eae6a1b](https://github.com/notaduck007/orange-collar-jobs/commit/eae6a1b8396fb9a8c957687a33f30bf6baac06cb))

## [1.3.1](https://github.com/notaduck007/orange-collar-jobs/compare/v1.3.0...v1.3.1) (2026-06-25)


### Bug Fixes

* **version:** patched version ([6ba6244](https://github.com/notaduck007/orange-collar-jobs/commit/6ba6244d6735beeb4762861c1b32a879a17e6646))

# [1.3.0](https://github.com/notaduck007/orange-collar-jobs/compare/v1.2.0...v1.3.0) (2026-06-25)


### Bug Fixes

* **ci:** resolve batch worker early exit and test runner issues ([5809409](https://github.com/notaduck007/orange-collar-jobs/commit/5809409f1d1a861c66235fa6dd59af18f1005e65))
* **ci:** resolve Postman folder name and batch worker race condition ([6845b5f](https://github.com/notaduck007/orange-collar-jobs/commit/6845b5fd28f3a72cecb659860f6420778242648e))
* **tests:** fixed all errors with tests executed in ci workflows ([12ec195](https://github.com/notaduck007/orange-collar-jobs/commit/12ec195ea96c8d3e2facbb49f0e9b79611e47417))


### Features

* **api,frontend:** complete phases 3–4.5, remove Supabase, add Postman tooling ([2673d75](https://github.com/notaduck007/orange-collar-jobs/commit/2673d75e91c155bca2bff624905e32135f0f8709))

# [1.2.0](https://github.com/notaduck007/orange-collar-jobs/compare/v1.1.1...v1.2.0) (2026-06-20)


### Bug Fixes

* **ci:** repair ci issues and repush ([a2dfb49](https://github.com/notaduck007/orange-collar-jobs/commit/a2dfb49188849b73d56c30e6c6417b30932c1f0c))
* **prisma:** Prisma client needs to exist before building the application ([37808e3](https://github.com/notaduck007/orange-collar-jobs/commit/37808e341807dd07cb986e55c66cd2ac167f837a))


### Features

* **api:** phase 3 jobs, contract drift guard, and Prisma 7 upgrade ([086fff9](https://github.com/notaduck007/orange-collar-jobs/commit/086fff9b141a72679e5cdb88d3d137741b5432f0))

## [1.1.1](https://github.com/notaduck007/orange-collar-jobs/compare/v1.1.0...v1.1.1) (2026-06-14)


### Bug Fixes

* **version:** bump api version from 1.0.0 to 1.1.0 ([b8ffd4e](https://github.com/notaduck007/orange-collar-jobs/commit/b8ffd4e449a0633ea027dc4e26a585b1e7d4ec8f))

# [1.1.0](https://github.com/notaduck007/orange-collar-jobs/compare/v1.0.0...v1.1.0) (2026-06-14)

### Bug Fixes

- **ci:** adjust postman scripts to address errors while in ci workflows ([7e8e56d](https://github.com/notaduck007/orange-collar-jobs/commit/7e8e56df779e84348bb86409aa28bb0ebe6fc647))
- **ci:** run Newman against live API instead of Postman Cloud ([71fb2ba](https://github.com/notaduck007/orange-collar-jobs/commit/71fb2ba8641b5ae68798a53545d6eb12e8be97b3))
- **ci:** run Newman against live API instead of Postman Cloud ([033a23c](https://github.com/notaduck007/orange-collar-jobs/commit/033a23c386325af787a0d9d46c6cc79eb36749cf))
- **postman:** collection file was incorrectly formatted ([a7990af](https://github.com/notaduck007/orange-collar-jobs/commit/a7990af31233d00f80538bea469461056fef9a47))

### Features

- **auth:** deliver Phase 2 JWT auth with frontend and compat gates, includes postman workflows and tests ([d7c6269](https://github.com/notaduck007/orange-collar-jobs/commit/d7c626977fb5b3ce029cae80e2c5e476c43efd8d))

# 1.0.0 (2026-06-13)

### Bug Fixes

- **ci:** correct minio/mc entrypoint in ci-minio-up.sh ([29cab93](https://github.com/notaduck007/orange-collar-jobs/commit/29cab93efb81d388e23e5b2b48a7fad7e6ac9c7b))
- **ci:** repair unit and integration test failures in GitHub Actions ([91be460](https://github.com/notaduck007/orange-collar-jobs/commit/91be460fadc6e40a9c5366a595cc10e80e635a8d))
- **ci:** skip duplicate MinIO setup in integration tests ([f5e73e1](https://github.com/notaduck007/orange-collar-jobs/commit/f5e73e1a66672b46fc8f2d685e74a6bca2329ee8))
- **ci:** start MinIO via docker run instead of unreliable GHA service container ([cd5a48e](https://github.com/notaduck007/orange-collar-jobs/commit/cd5a48e8df534e4c12dc36d7bd1745183d374ee4))
- **containers:** fix containerization issues and test openapi deploy automation ([889922b](https://github.com/notaduck007/orange-collar-jobs/commit/889922bb6e156ef60bec84b78f7fd348fd9a2713))
- **lint:** lint fix ([ce91535](https://github.com/notaduck007/orange-collar-jobs/commit/ce91535e8518f93405061de57c3c5507c76ec549))

### Features

- **phase1:** ai documentation, development planning, cost calculations and phase1 ([f862adc](https://github.com/notaduck007/orange-collar-jobs/commit/f862adca6de0779ad236ebe2ef61cff538212e82))
- **phase1:** complete Phase 1 gate with API versioning, test suite, and monorepo hardening ([936b387](https://github.com/notaduck007/orange-collar-jobs/commit/936b3878bdc78c0744927eef95b0b6fb35d24951))
