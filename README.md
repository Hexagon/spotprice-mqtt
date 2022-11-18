# spotprice-mqtt

This project provides a docker image which allows users collect spot prices from the web, and forward it to a MQTT broker.

## Installation

### Installing from Docker Hub

Install from Docker hub using the following command, make sure to change SP_MQTT_HOST/PORT/CURRENCY/AREA/TOPIC/ENTITY/DECIMALS to your own settings.

Please note that spotprice-mqtt doesn't support mqtt authentication yet.

With the default/example settings, the image will fetch spot prices every full hour, and forward it to homeassistant/sensor/spotprice_*/state, it will also send homeassistant/sensor/spotprice_*/config to make mqtt autodiscover the entities correctly.

These sensors are provided (if you use the default value for SP_ENTITY, which is "spotprice")

| Sensor                                       | Type  | Description                           |
|----------------------------------------------|-------|---------------------------------------|
| sensor.spotprice_now                         | Float | Spot price right now                   |
| sensor.spotprice_1h - spot price in 1 hour   | Float | Spot price for next hour               |
| sensor.spotprice_6h - spot price in 6 hours  | Float | Spot price 6 hours from now            |
| sensor.spotprice_12h - spot price in 12 hour | Float | Spot price 6 hours from now            |
| sensor.spotprice_today_max                   | Float | Highest spot price today               |
| sensor.spotprice_today_max_time              | ISO8601 date | Datetime when highest spot price occur |
| sensor.spotprice_today_min                   | Float | Lowest spot price today                |
| sensor.spotprice_today_min_time              | ISO8601 date | Datetime when lowest spot price occur  |
| sensor.spotprice_tomorrow_max                | Float | Highest spot price tomorrow            |
| sensor.spotprice_tomorrow_max_time           | ISO8601 date | Datetime when highest spot price occur |
| sensor.spotprice_tomorrow_min                | Float | Lowest spot price tomorrow             |
| sensor.spotprice_tomorrow_min_time           | ISO8601 date | Datetime when lowest spot price occur  |

These environment variables can be sent to docker

| Variable name | Description                         | Example                |
|---------------|-------------------------------------|------------------------|
| SP_MQTT_HOST  | IP to MQTT broker                   | 192.168.1.4            |
| SP_MQTT_PORT  | Port on MQTT broker                 | 1883                   |
| SP_CURRENCY   | Currency                            | SEK                    |
| SP_AREA       | Electricity price area              | SE4                    |
| SP_TOPIC      | Base topic                          | homeassistant/sensors/ |
| SP_ENTITY     | Beginning of sensor names           | spotprice              |
| SP_DECIMALS   | Maximum number of decimals in price | 4                      |

Example command using homeassistant/sensors/ as base topic, which will make HA autodiscover the entities.

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
        hexagon/spotprice-mqtt:latest
```

View logs by running

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

Then pull the latest version

```docker pull hexagon/spotprice-mqtt:latest```

Then follow the above instruction to re-install from Docker Hub (or manually if you wish).

## Running src/spotprices.js standalone

Something like this:

`deno run -A .\src\spotpricer.js --host=192.168.1.4 --port=1883 --currency=NOK --area SE2 --currency SEK --topic=homeassistant/sensor/ --entity spotprice --decimals 5`