FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_BRAIN_KIND=finance
ARG VITE_BRAIN_API_URL=http://localhost:8787
ENV VITE_BRAIN_KIND=$VITE_BRAIN_KIND
ENV VITE_BRAIN_API_URL=$VITE_BRAIN_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
