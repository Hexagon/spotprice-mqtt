# spotprice-mqtt

Docker image which periodically scrapes spot prices from the web, and forward it to a MQTT broker.

### Features

*  Build in automation, update prices every 30 minutes
*  Sends future spot prices as separate states (+1 hour, +6 hours, +12 hours)
*  Sensds average spot price for today and tomorrow
*  Sensds average spot price for night, morning, evening and night, both today and tomorrow
*  Allows to add extra cost and apply a factor (e.g. VAT) onto spot prices
*  Handles time zone conversion automatically, just supply and receive local time
*  Supports Home Assistant MQTT auto discovery ootb
*  Sends full dataset in JSON format as an attribute to `sensor.spotprice_data`, allowing to create a forecast chart in homeassistant unsing (as an example) apexchart-card

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
| sensor.spotprice_avg           | Float | Average spotprice today |
| sensor.spotprice_night_avg           | Float | Average spotprice today 00:00-06:00  |
| sensor.spotprice_morning_avg           | Float | Average spotprice today 06:00-12:00  |
| sensor.spotprice_afternoon_avg           | Float | Average spotprice today 12:00-18:00  |
| sensor.spotprice_evening_avg           | Float | Average spotprice today 18:00-24:00  |
| sensor.spotprice_tomorrow_avg           | Float | Average spotprice tomorrow |
| sensor.spotprice_tomorrow_night_avg           | Float | Average spotprice tomorrow 00:00-06:00  |
| sensor.spotprice_tomorrow_morning_avg           | Float | Average spotprice tomorrow 06:00-12:00  |
| sensor.spotprice_tomorrow_afternoon_avg           | Float | Average spotprice tomorrow 12:00-18:00  |
| sensor.spotprice_tomorrow_evening_avg           | Float | Average spotprice tomorrow 18:00-24:00  |
| sensor.spotprice_data                        | JSON | Raw data to build a forecast chart  |

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
| SP_FACTOR     | Price correction factor             | 1                      |
| SP_EXTRA      | Price correction before factor      | 0                      |

To get actual prices in sweden as of nov 2022 you set SP_EXTRA to about 0.095 (9.5 öre certificate fees etc), and SP_FACTOR to 1.25 (25% VAT)

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
        -e SP_FACTOR=1 \
        -e SP_EXTRA=0 \
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

## Upgrading

First stop and remove previous version

```docker stop spotprice-mqtt```

```docker rm spotprice-mqtt```

Then pull the latest version

```docker pull hexagon/spotprice-mqtt:latest```

Then follow the above instruction to re-install from Docker Hub (or manually if you wish).

## Running src/spotprices.js standalone

Use omething like this:

`deno run -A .\src\spotpricer.js --host=192.168.1.4 --port=1883 --currency=NOK --area SE2 --factor 1 --currency SEK --topic=homeassistant/sensor/ --entity spotprice --decimals 5 --factor 1 --extra 0`