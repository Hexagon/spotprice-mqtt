#!/bin/sh

deno run --allow-net /spotprice-mqtt/spotpricer.js --host $SP_MQTT_HOST --port $SP_MQTT_PORT --topic $SP_TOPIC --entity $SP_ENTITY --currency $SP_CURRENCY --area $SP_AREA >> /tmp/spotpricer.log 2>&1
