#stage 1
FROM node:24-alpine as dev
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm install -g @angular/cli@21
RUN npm install --verbose
COPY --chown=node:node . .
RUN npm run build:prod
#stage 2
FROM nginx
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=dev /app/dist/web-star-fleet/browser /usr/share/nginx/html
# Expose port 80
EXPOSE 80
