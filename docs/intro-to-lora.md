# Building your own private LoRa network

There is a lot of buzz around [LoRa](https://www.lora-alliance.org), a wide-area network solution that promises kilometers of range with very low power consumption; a perfect fit for the Internet of Things. A number of telecom operators are currently rolling out networks, but because LoRa operates in the [open spectrum](https://en.wikipedia.org/wiki/ISM_band) you can also set up your own network. In this article we'll go over all the pieces required to build a private LoRa network, and how to use the network to send data from an ARM mbed end-node to the cloud.

## Requirements

A typical LoRa network consists of four parts: devices, gateways, a network service and an application:

<span class="images">![Topology of a LoRa network](assets/lora1.png)<span>Topology of a LoRa network</span></span>

On the hardware side we need devices and gateways, similar to how we set up a WiFi network. Gateways are very simple: they just scan the spectrum and capture LoRa packets. There is also no gateway pinning here - devices are not associated with a single gateway; thus all gateways within range of a device will receive the signal. The gateways then forward their data to a network service that handles the packet.

The network service de-duplicates packets when multiple gateways receive the same packet, decrypts the message (everything is end-to-end encrypted), handles LoRa features like adaptive data rating, and so on. It then forwards the decrypted data to your application.

That gives us five requirements.

We need hardware:

* Gateways
* Devices

And we need software:

* Device firmware
* A network service
* An app

In this guide we'll show you which hardware you can buy, and we'll use two online services that will make it easy to write device firmware and handle your LoRa traffic.

### Getting a gateway

There's quite some [choice in the gateways](https://www.loriot.io/gateways.html) we can use, but I've had good experience with these three:

* [Kerlink IoT station](http://www.kerlink.fr/en/products/lora-iot-station-2/lora-iot-station-868-mhz). Expensive (around 1,200 euros), but great build quality and range.
* [Multitech Conduit](http://www.multitech.com/brands/multiconnect-conduit). About a third of the price of the Kerlink (around 450 euros), and pretty great for small setups (put a bigger antenna on it though). Multitech also has a [rugged outdoor](http://www.multitech.com/brands/multiconnect-conduit-ip67) version.
* Building your own with a Raspberry Pi and an [IMST iC880A](http://webshop.imst.de/catalogsearch/result/?q=iC880A) concentrator. At around 230 euros, this is the most cost-efficient option.


<span class="images">![Self built gateway using a Raspberry Pi and an IMST iC880A](assets/lora5.jpg)<span>Self built LoRa gateway based on Raspberry Pi 2 and IMST iC880A. Total cost about 230 euros.</span></span>


For development purposes one gateway will be enough, but in a production deployment you'll want at least two, as there will always be dark spots in your network.

### Getting a device

We'll also need to build devices. If you want to use ARM mbed (and you should) you can either get:

* A development board with a LoRa transceiver:
    * [Multitech xDot](https://developer.mbed.org/platforms/MTS-xDot-L151CC/).
        * The xDot is already FCC/CE certified and shielded, so it's a good choice if you want to build custom hardware.
    * [Multitech mDot](https://developer.mbed.org/platforms/MTS-mDot-F411/) and the [UDK2 board](http://www.digikey.com/product-detail/en/multi-tech-systems-inc/MTUDK2-ST-MDOT/591-1278-ND/5247463).
        * As an alternative, you can use the [mDot EVB](https://developer.mbed.org/platforms/mdotevb/), which is the mDot reference design.
        * Like the xDot, the mDot is already FCC/CE certified and shielded.
* A microcontroller that runs mbed (in this article I'm using the [nrf51-DK](https://developer.mbed.org/platforms/Nordic-nRF51-DK/), although most microcontrollers will work) with a LoRa shield:
    * [SX1272MB2xAS](https://developer.mbed.org/components/SX1272MB2xAS/) - shield based on the SX1272 transceiver.
    * [SX1276MB1xAS](https://developer.mbed.org/components/SX1276MB1xAS/) - shield based on the SX1276 transceiver.

In this document we show how to connect the Multitech mDot and the SX1276MB1xAS shield, but the same principles apply to all other combinations.

<span class="notes">**Note:** When ordering hardware, always make sure that you get the variant that works in your region (for example 868 MHz in Europe, 915 MHz in the US).</span>

### Network server

Now on to the software side. We'll need a server that understands the LoRa protocol and can interpret the data being sent from the device. It's possible to roll your own (Semtech can give you their reference implementation if you sign an NDA), but there are also companies building LoRa Network Servers as a service, handling everything on your behalf. In this article we'll discuss two such services: the Switzerland-based startup [LORIOT](https://loriot.io), and [IoT-X](http://iot-x.com) from the UK-based Stream Technologies.

As a network server just processes your data - it doesn't store it - you'll need a place to store your messages as well. Both services allows you to hook into their service over a TCP socket, websocket or MQTT client and forward your data to the cloud service of your choice (or straight to your application).

#### LORIOT

LORIOT is free for up to one gateway, and up to ten end-devices. Unfortunately the free plan has some limitations: it does not include bi-directional data (sending messages back from the cloud to a device) and over-the-air activation. These services can be bought as an upgrade though (starting at 57 euros per month).

#### IoT-X

IoT-X is a connectivity management platform from Stream Technologies, which handles both cellular and LoRa connected devices. A form to request a trial is available on their website.

## Setting up the gateway

We now need to configure our gateway by installing some software that will scan the spectrum and forward all LoRa packets to the network server. To do this we'll need to log into the gateway. Here are setup instructions for the three gateways mentioned earlier.

<span class="notes">**Note:** This section assumes that you're familiar with SSH.</span>

### Kerlink IoT station

To configure the Kerlink:

1. Connect the gateway to your network over Ethernet.
1. The gateway gets an IP through DHCP.
1. To quickly find the gateway you can look in the DHCP table on your router, or use [nmap](http://nmap.org) via `nmap -p 22 192.168.2.*` (if that's your subnet).
1. You can now log into the gateway through SSH, with the username `root` and password `root`.

Often the Kerlink IoT station comes pre-configured with the packet forwarder (run `ps | grep pkt` to see if one is running). If this is the case, make sure the packet forwarder does not start on startup by removing the entry from `/etc/init.d`.

### Multitech Conduit

The Conduit is unfortunately configured with DHCP disabled, so we need to enable this first. There are two options: Ethernet and micro-USB.

__Using Ethernet__

1. Connect to the Conduit over Ethernet (from the Conduit to your computer).
1. Set a static IP address of 192.168.2.2 for your computer.
1. Set a static IP address of 192.168.2.1 as your router.
1. Log in through SSH to 192.168.2.1, with the username `root` and password `root`.


__Over micro-USB__

1. Connect to the Conduit using a micro-USB cable.
1. The gateway appears as a serial device.
1. You can use a program like [GNU screen](https://www.gnu.org/software/screen/) or [PuTTY](http://putty.org) to log into the gateway.

Now that we are connected we can set up the gateway:

1.  Enable DHCP by following Step 4 in [this document](http://www.multitech.net/developer/software/mlinux/getting-started-with-conduit-mlinux/).
1. Connect the gateway over Ethernet to your router.
1. Follow the steps under 'Kerlink IoT station' to find the IP address and log in over SSH.

### Raspberry Pi and IMST iC880A

First make sure that the Raspberry Pi is connected to the internet, and that you connected the IMST iC880A over USB (if you have the SPI version, take a look at the [IMST website](http://www.wireless-solutions.de/products/radiomodules/ic880a)).

Log into the Pi over SSH, and follow Steps 3.1 - 3.5 in [this document](http://www.wireless-solutions.de/images/stories/downloads/Radio%20Modules/iC880A/iC880A_QuickStartGuide.pdf).

<span class="notes">**Note:** Use [lora_gateway 2.0.0](https://github.com/Lora-net/lora_gateway/releases/tag/v2.0.0), not the latest version (run `git checkout v2.0.0` in the lora_gateway folder).</span>

After following these steps:

1. Restart the Pi.
1. Run:

    ``~/LoRa/lora_gateway/lora_gateway/util_pkt_logger/util_pkt_logger``

1. You should see 'INFO: concentrator started, packet can now be received', which indicates that everything is functioning.

## Setting up the network server

Now that we have set up the gateways and they can reach the internet, it's time to install the network service software on them, so they have a place to send the LoRa packets.

* [Continue setting up your network with LORIOT](loriot.md).
* [Continue setting up your network with IoT-X](iotx.md).
