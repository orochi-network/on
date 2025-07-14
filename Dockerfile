FROM node:22

WORKDIR /app
COPY package*.json ./
RUN yarn
RUN yarn complie
COPY . .

# docker build --no-cache -t localnode:latest . 
# docker run --name localrpc -ti -p 8545:8545 --rm localnode
CMD ["/app/entry.sh"]