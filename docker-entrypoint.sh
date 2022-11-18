#!/bin/sh
touch /tmp/spotpricer.log
echo "Starting spotprice-mqtt"
crond -b -l 2 && tail -f /tmp/spotpricer.log
