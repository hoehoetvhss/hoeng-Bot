FROM node:22.22.3-slim AS node_build

WORKDIR /tmp

COPY . .

RUN npm ci && \
    cd dashboard && npm ci && cd .. && \
    npm run build


############################################################

FROM node:22.22.3-slim

WORKDIR /bot

RUN apt update -y && \
    apt install openjdk-17-jre-headless -y && \
    apt clean && rm -rf /var/lib/apt/lists/*


COPY --from=node_build /tmp/dist /bot
COPY --from=node_build /tmp/node_modules /bot/node_modules
COPY --from=node_build /tmp/server /bot/server
COPY --from=node_build /tmp/dashboard/.output/public /bot/dashboard/.output/public

COPY --from=node_build /tmp/package*.json /bot
COPY --from=node_build /tmp/config.js /bot


ENTRYPOINT ["npm", "run", "start:server"]