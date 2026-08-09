FROM ubuntu:26.04 AS node_build

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Seoul

RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    build-essential \
    tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && curl -fsSL https://deb.nodesource.com/setup_26.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp

COPY package*.json ./
RUN npm install

COPY dashboard/package*.json ./dashboard/
RUN cd dashboard && npm install

COPY . .
RUN npm run build

FROM ubuntu:26.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Seoul

RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && curl -fsSL https://deb.nodesource.com/setup_26.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /bot

COPY --from=node_build /tmp/dist /bot/dist
COPY --from=node_build /tmp/node_modules /bot/node_modules
COPY --from=node_build /tmp/dashboard/.output/public /bot/dashboard/.output/public

COPY --from=node_build /tmp/package*.json /bot
COPY --from=node_build /tmp/config.js /bot/config.js

RUN mkdir -p data logs

ENTRYPOINT ["npm", "run", "start:server"]
