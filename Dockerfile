FROM node:22

WORKDIR /app
COPY package*.json ./
RUN yarn
COPY . .
RUN yarn compile

# docker build  --progress plain --no-cache -t localnode:latest .
# docker run --name localrpc -ti -p 8545:8545 --rm localnode
CMD ["/app/entry.sh"]