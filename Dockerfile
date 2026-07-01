FROM node:22-alpine AS build

ARG CLI_VERSION_ARG=dev
WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json ./
COPY src ./src
COPY skills ./skills
COPY sandbox ./sandbox
COPY docs ./docs
COPY README.md LICENSE ./

RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/skills ./skills
COPY --from=build /app/sandbox ./sandbox
COPY --from=build /app/docs ./docs
COPY --from=build /app/README.md /app/LICENSE ./

ENTRYPOINT ["node", "/app/dist/cli/index.js"]
