# [1.1.0](https://github.com/notaduck007/orange-collar-jobs/compare/v1.0.0...v1.1.0) (2026-06-14)


### Bug Fixes

* **ci:** adjust postman scripts to address errors while in ci workflows ([7e8e56d](https://github.com/notaduck007/orange-collar-jobs/commit/7e8e56df779e84348bb86409aa28bb0ebe6fc647))
* **ci:** run Newman against live API instead of Postman Cloud ([71fb2ba](https://github.com/notaduck007/orange-collar-jobs/commit/71fb2ba8641b5ae68798a53545d6eb12e8be97b3))
* **ci:** run Newman against live API instead of Postman Cloud ([033a23c](https://github.com/notaduck007/orange-collar-jobs/commit/033a23c386325af787a0d9d46c6cc79eb36749cf))
* **postman:** collection file was incorrectly formatted ([a7990af](https://github.com/notaduck007/orange-collar-jobs/commit/a7990af31233d00f80538bea469461056fef9a47))


### Features

* **auth:** deliver Phase 2 JWT auth with frontend and compat gates, includes postman workflows and tests ([d7c6269](https://github.com/notaduck007/orange-collar-jobs/commit/d7c626977fb5b3ce029cae80e2c5e476c43efd8d))

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
