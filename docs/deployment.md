# Site deployment

This repository contains two deployable forms of the pediatric anemia decision-support research prototype.

## Static clinician site

The browser runs the deterministic inference engine locally. Patient assessment inputs are not sent to the included API by the web interface.

```bash
npm run build
```

Publish the generated `dist/` directory with any HTTPS static-file host. The output includes restrictive security headers for hosts that honor a `_headers` file and a `robots.txt` file that blocks indexing. Configure equivalent headers directly at the CDN or reverse proxy when the host does not honor `_headers`.

Required behavior:

- serve all files over HTTPS;
- preserve JavaScript module MIME type as `text/javascript`;
- serve JSON as `application/json`;
- do not inject analytics, session replay, advertising, chat widgets, or third-party scripts into assessment pages;
- retain `Cache-Control: no-store` until a reviewed caching and privacy design exists;
- prevent search indexing while the product remains an unvalidated research prototype.

## Node site and prototype API

```bash
npm start
```

Environment variables:

- `HOST`: bind address; defaults to `127.0.0.1`.
- `PORT`: listening port; defaults to `8080`.

Container deployment:

```bash
docker build -t pediatric-anemia-cdss .
docker run --rm -p 8080:8080 pediatric-anemia-cdss
```

The Node server serves the same site and exposes `/health`, `/api/v1/knowledge-base`, and `/api/v1/assess`. It intentionally does not log or persist assessment bodies. Production infrastructure, however, may log requests unless explicitly configured not to do so.

## Mandatory production gate

Do not place the site in clinical use merely because it deploys successfully. Clinical-content review, source-to-rule traceability, multi-site validation, prospective silent-mode evaluation, human-factors testing, security/privacy review, quality-system controls, and a documented regulatory determination remain required.
