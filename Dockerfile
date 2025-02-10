FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Expose both HTTP and WebSocket ports
EXPOSE 4000/tcp
EXPOSE 4000/udp

CMD ["npm", "start"] 