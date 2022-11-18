# spotprice-mqtt

This project provides a docker image which allows users collect spot prices from the web, and forward it to a MQTT broker.

## Installation

### Installing from Docker Hub

Install from Docker hub using the following command, make sure to change SP_MQTT_HOST/PORT/CURRENCY/AREA/TOPIC/ENTITY to your own settings.

With the default/example settings, the image will fetch spot prices every full hour, and forward it to homeassistant/sensor/spotprice_*/state, it will also send homeassistant/sensor/spotprice_*/config to make mqtt autodiscover the entities correctly.

These sensors are provided

```
sensor.spotprice_now
sensor.spotprice_1h - spot price in 1 hour
sensor.spotprice_6h - spot price in 6 hours
sensor.spotprice_12h - spot price in 12 hour
sensor.spotprice_today_max
sensor.spotprice_today_max_time
sensor.spotprice_today_min
sensor.spotprice_today_min_time
sensor.spotprice_tomorrow_max
sensor.spotprice_tomorrow_max_time
sensor.spotprice_tomorrow_min
sensor.spotprice_tomorrow_min_time
```

Please note that spotprice-mqtt doesn't support mqtt authentication yet.

```
docker run \
        -d \
        --net=host \
        --restart=always \
        -e SP_MQTT_HOST=192.168.1.4 \
        -e SP_MQTT_PORT=1883 \
        -e SP_CURRENCY=SEK \
        -e SP_AREA=SE2 \
        -e SP_TOPIC=homeassistant/sensor/ \
        -e SP_ENTITY=spotprice \
        -e SP_DECIMALS=5 \
        --name="spotprice-mqtt" \
        hexagon/spotprice-mqtt
```

Logs available by running

```
docker logs spotprice-mqtt
```

### Manual/Local installation

If you want to build the docker image yourself, clone this repository and run

```docker build . --tag=local-spotprice-mqtt```

Then use the command from the installation section, but replace ```hexagon/spotprice-mqtt``` with ```local-spotprice-mqtt```.

```
docker run -d --net=host --restart=always -e SP_MQTT_HOST=192.168.1.4 -e SP_MQTT_PORT=1883 -e SP_CURRENCY=SEK -e SP_AREA=SE2 -e SP_TOPIC=homeassistant/sensor/ -e SP_ENTITY=spotprice --name="spotprice-mqtt" local-spotprice-mqtt
```
### Upgrading from a previous version

First stop and remove previous version

```docker stop spotprice-mqtt```

```docker rm spotprice-mqtt```

Then follow the above instruction to re-install from Docker Hub (or manually if you wish).

## Running src/spotprices.js standalone

Something like this:

`deno run -A .\src\spotpricer.js --host=192.168.1.4 --port=1883 --currency=NOK --area SE2 --currency SEK --topic=homeassistant/sensor/ --entity spotprice --decimals 5`