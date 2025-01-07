# TouchKio - Supported Hardware
This document contains an incomplete list of device and display hardware combinations that are either intended to be tested or have already been tested.

The [release](https://github.com/leukipp/touchkio/releases) page has builds exclusively for **arm64**, but custom builds for other architectures can be made (see [Development](https://github.com/leukipp/touchkio?tab=readme-ov-file#development)), allowing the application to operate on any hardware.
At least the **minimal** features, such as displaying a **kiosk window** (which doesn't necessarily need to be Home Assistant) will work.

## Hardware
Any SBC clones of the Raspberry Pi that operate on **Raspberry Pi OS (64-bit)** and **Wayland** are likely to function as well.

### DSI
| Device         | Display                                                                                         | Tested | Status            | Notes                                                  |
| -------------- | ----------------------------------------------------------------------------------------------- | ------ | ----------------- | ------------------------------------------------------ |
| Raspberry Pi 3 | [Official 7" Touch Display 1](https://www.raspberrypi.com/products/raspberry-pi-touch-display/) | ❌      | Unknown           | 99% chance that it is slow and the resolution sucks.   |
| Raspberry Pi 3 | [Official 7" Touch Display 2](https://www.raspberrypi.com/products/touch-display-2/)            | ❌      | Unknown           | 99% chance that it is slow.                            |
| Raspberry Pi 4 | [Official 7" Touch Display 1](https://www.raspberrypi.com/products/raspberry-pi-touch-display/) | ❌      | Unknown           | 99% chance that the resolution sucks.                  |
| Raspberry Pi 4 | [Official 7" Touch Display 2](https://www.raspberrypi.com/products/touch-display-2/)            | ❌      | Optimistic        | 99% chance that it fully works.                        |
| Raspberry Pi 5 | [Official 7" Touch Display 1](https://www.raspberrypi.com/products/raspberry-pi-touch-display/) | ❌      | Unknown           | 99% chance that the resolution sucks.                  |
| Raspberry Pi 5 | [Official 7" Touch Display 2](https://www.raspberrypi.com/products/touch-display-2/)            | ✅      | Fully operational | Working display power and brightness control via MQTT. |

### HDMI
| Device         | Display           | Tested | Status                | Notes                                                 |
| -------------- | ----------------- | ------ | --------------------- | ----------------------------------------------------- |
| Raspberry Pi 4 | -                 | ✅      | Partially operational | -                                                     |
| Raspberry Pi 5 | Generic Non-Touch | ✅      | Partially operational | Display brightness control is not available via MQTT. |

## Contributions
In case your hardware is not listed above don't worry, give it a try.
Running `touchkio --web-url=https://demo.home-assistant.io` will most likely just work.
The only problems that may arise are when controlling the display via the Home Assistant integration.

- If you encounter any problems, please create a new [issue](https://github.com/leukipp/touchkio/issues).
- If you encounter any problems and are able to fix it yourself, feel free to create a [pull request](https://github.com/leukipp/touchkio/pulls).
- If everything works as expected and your hardware is not yet listed, you are welcome to add it and create a [pull request](https://github.com/leukipp/touchkio/pulls).
