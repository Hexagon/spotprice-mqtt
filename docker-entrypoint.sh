#!/bin/sh
touch /tmp/spotpricer.log

echo "Starting spotprice-mqtt (initial run)"
/bin/sh /spotprice-mqtt/spotprice-mqtt.sh

echo "Scheduling spotprice-mqtt using crond"
crond -b -l 2 && tail -f /tmp/spotpricer.log
