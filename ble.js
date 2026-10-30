
/*
 * ble.js
 * BLE 蓝牙通信模块
 *
 * 当前状态：通信代码已准备，真实硬件尚未验证
 */

const BLE_CONFIG = {
    // 暂定 UUID，等待 HC-04D 实物确认
    serviceUUID: "0000ffe0-0000-1000-8000-00805f9b34fb",

    characteristicUUID: "0000ffe1-0000-1000-8000-00805f9b34fb"
};

export class BleController {

    constructor() {
        this.device = null;
        this.server = null;
        this.characteristic = null;

        this.manualDisconnect = false;
    }

    /* =========================
       1. 蓝牙连接
       ========================= */

    async connect(
        onData = () => {},
        onDisconnect = () => {}
    ) {
        if (!navigator.bluetooth) {
            throw new Error("浏览器不支持 Web Bluetooth");
        }

        this.manualDisconnect = false;

        // 每次连接都创建独立的数据缓存
        let receiveBuffer = "";
        const decoder = new TextDecoder();

        this.device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [BLE_CONFIG.serviceUUID]
        });

        this.device.addEventListener(
            "gattserverdisconnected",
            () => {
                this.server = null;
                this.characteristic = null;

                if (this.manualDisconnect) {
                    this.manualDisconnect = false;
                    return;
                }

                onDisconnect();
            }
        );

        this.server = await this.device.gatt.connect();

        const service = await this.server.getPrimaryService(
            BLE_CONFIG.serviceUUID
        );

        this.characteristic = await service.getCharacteristic(
            BLE_CONFIG.characteristicUUID
        );

        /* =========================
           2. 接收蓝牙数据
           ========================= */

        if (this.characteristic.properties.notify) {

            await this.characteristic.startNotifications();

            this.characteristic.addEventListener(
                "characteristicvaluechanged",
                event => {

                    const value = event.target.value;

                    const bytes = new Uint8Array(
                        value.buffer,
                        value.byteOffset,
                        value.byteLength
                    );

                    // 将本次收到的数据加入缓存
                    receiveBuffer += decoder.decode(
                        bytes,
                        { stream: true }
                    );

                    // 按换行符拆分完整消息
                    const messages = receiveBuffer.split(/\r?\n/);

                    // 保留最后一段未接收完整的数据
                    receiveBuffer = messages.pop();

                    // 逐条处理完整消息
                    for (const message of messages) {

                        const cleanMessage = message.trim();

                        if (cleanMessage.length > 0) {
                            onData(cleanMessage);
                        }
                    }

                    // 防止异常数据导致缓存无限增长
                    if (receiveBuffer.length > 1024) {
                        receiveBuffer = "";
                        console.warn("BLE 接收缓存过长，已清空");
                    }
                }
            );
        }

        return this.device.name || "未命名蓝牙设备";
    }

    /* =========================
       3. 发送蓝牙指令
       ========================= */

    async send(text) {

        if (!this.characteristic) {
            throw new Error("蓝牙尚未连接");
        }

        const data = new TextEncoder().encode(text);

        if (this.characteristic.properties.write) {

            await this.characteristic.writeValueWithResponse(data);

        } else if (
            this.characteristic.properties.writeWithoutResponse
        ) {

            await this.characteristic.writeValueWithoutResponse(data);

        } else {

            throw new Error("蓝牙特征值不支持写入");
        }
    }

    /* =========================
       4. 断开蓝牙
       ========================= */

    disconnect() {

        this.manualDisconnect = true;

        if (this.device?.gatt?.connected) {

            this.device.gatt.disconnect();

        } else {

            this.manualDisconnect = false;
        }

        this.server = null;
        this.characteristic = null;
    }
}
