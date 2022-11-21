
FROM denoland/deno:alpine-1.28.1

# Install cron job
COPY crontabs/root /etc/crontabs/root

# Give execution rights on the cron job
RUN chmod 0644 /etc/crontabs/root

# Copy radoneye script
RUN mkdir /spotprice-mqtt
COPY build/* /spotprice-mqtt/
COPY script/* /spotprice-mqtt/

# Give execution rights on the launcher script
RUN chmod 0644 /spotprice-mqtt/spotprice-mqtt.sh

# Copy entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN ["chmod", "+x", "/docker-entrypoint.sh"]

# Go!
ENTRYPOINT ["/docker-entrypoint.sh"]
