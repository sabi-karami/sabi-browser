FROM mcr.microsoft.com/playwright:v1.57.0-noble
WORKDIR /srv/sabi
COPY package.json ./
RUN npm install --ignore-scripts --omit=dev --no-audit --no-fund
COPY --chown=pwuser:pwuser server.mjs control.mjs ui.html vazirmatn.woff2 estedad.woff2 ./
USER pwuser
CMD ["node","server.mjs"]
