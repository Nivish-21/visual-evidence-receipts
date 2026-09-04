# Contributing

## Development gates

Run before every commit:

```bash
npm test
npm run lint
npm run typecheck
npm run format
npm run build
```

## Security boundaries

- Never commit `.env`, provider credentials, wallet keys, images, crops, embeddings, or `.evidence/` run output.
- Use `npm ci`, not a floating dependency install.
- Keep public-chain payloads privacy-minimized.
- Do not replace live discovery with a fixture outside tests.

## Documentation

Update `README.md` and the relevant `docs/` entry in the same task whenever CLI behavior, policies, or setup changes.
