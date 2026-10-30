import { BleController } from "./ble.js";

/* =========================
   1. 页面元素
   ========================= */

const $ = (id) => document.getElementById(id);

const connectionDot = $("connection-dot");
const connectionStatus = $("connection-status");
const deviceStatusDot = $("device-status-dot");
const deviceStatusText = $("device-status-text");
const deviceSummary = $("device-summary");
const deviceSummaryNote = $("device-summary-note");
const deviceStatusDetail = $("device-status-detail");

const deviceFeedback = $("device-feedback");
const controlMode = $("control-mode");
const deviceName = $("device-name");

const operationLog = $("operation-log");
const logCount = $("log-count");
const toast = $("toast");

const ble = new BleController();

/* =========================
   2. 当前状态
   ========================= */

let useSimulation = true;
let ledIsOn = false;
let lampIsOn = true;

let focusSeconds = 25 * 60;
let focusTimer = null;

const courseDays = [
    "周一",
    "周二",
    "周三",
    "周四",
    "周五",
    "周六",
    "周日"
];

const jsDay = new Date().getDay();
const todayDay = courseDays[jsDay === 0 ? 6 : jsDay - 1];

let selectedCourseDay = todayDay;
let courses = loadCourses();

/* =========================
   3. 通用提示
   ========================= */

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2400);
}

/* =========================
   4. 操作日志
   ========================= */

function updateLogCount() {
    logCount.textContent =
        operationLog.children.length + " 条记录";
}

function addLog(message, type = "INFO") {
    const item = document.createElement("li");
    const time = new Date().toLocaleTimeString(
        "zh-CN",
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    );

    item.innerHTML =
        '<span class="log-time">' +
        time +
        '</span><span></span><span class="log-badge">' +
        type +
        "</span>";

    item.children[1].textContent = message;

    operationLog.prepend(item);
    updateLogCount();
}

/* =========================
   5. 页面导航
   ========================= */

function switchView(viewName) {
    const views = document.querySelectorAll(".view");
    const navItems = document.querySelectorAll(".nav-item");

    const pageTitles = {
        dashboard: "下午好，开始有序的一天",
        schedule: "管理你的每一节课",
        focus: "把时间留给真正重要的事",
        device: "让设备成为专注的伙伴",
        reminder: "让提醒在恰好的时刻响起",
        logs: "每一次通信都有迹可循"
    };

    views.forEach((view) => {
        view.classList.toggle(
            "active",
            view.id === "view-" + viewName
        );
    });

    navItems.forEach((item) => {
        item.classList.toggle(
            "active",
            item.dataset.view === viewName
        );
    });

    $("page-title").textContent =
        pageTitles[viewName] || pageTitles.dashboard;
}

/* =========================
   6. 连接状态
   ========================= */

function setConnectionState(state, message) {
    connectionStatus.textContent = message;
    deviceStatusDetail.textContent = message;

    connectionDot.className = "status-dot";
    deviceStatusDot.className = "status-dot";

    if (state === "connected") {
        connectionDot.classList.add("status-connected");
        deviceStatusDot.classList.add("status-connected");

        deviceStatusText.textContent = "已连接";
        deviceSummary.textContent = "已连接";
        deviceSummaryNote.textContent =
            "HC-04D 已建立通信";
    } else if (state === "error") {
        connectionDot.classList.add("status-error");
        deviceStatusDot.classList.add("status-error");

        deviceStatusText.textContent = "连接异常";
        deviceSummary.textContent = "连接异常";
        deviceSummaryNote.textContent =
            "请检查蓝牙模块或浏览器权限";
    } else {
        deviceStatusText.textContent = "模拟模式";
        deviceSummary.textContent = "未连接";
        deviceSummaryNote.textContent =
            "等待 HC-04D 或继续使用模拟模式";
    }
}

function updateModeNotice(message) {
    controlMode.textContent = message;
}

/* =========================
   7. LED 状态
   ========================= */

function updateLedDisplay(isOn) {
    ledIsOn = isOn;

    const statusText = isOn ? "开启" : "关闭";
    const modeText = useSimulation ? "（模拟）" : "（设备反馈）";

    $("led-status").textContent = statusText + modeText;
    $("led-light").textContent = isOn ? "ON" : "OFF";
    $("led-light").style.color = isOn
        ? "#bb8a2e"
        : "#9aa9aa";
}

/* =========================
   8. 设备反馈
   ========================= */

function handleDeviceData(data) {
    const message = data.trim();

    addLog("收到设备数据：" + message, "RX");

    if (message === "LED:ON") {
        updateLedDisplay(true);
        deviceFeedback.textContent =
            "设备已确认：LED 开启";
        return;
    }

    if (message === "LED:OFF") {
        updateLedDisplay(false);
        deviceFeedback.textContent =
            "设备已确认：LED 关闭";
        return;
    }

    deviceFeedback.textContent =
        "收到设备数据：" + message;
}

/* =========================
   9. 蓝牙连接
   ========================= */

async function connectBluetooth() {
    if (!window.isSecureContext) {
        setConnectionState(
            "error",
            "网页环境不安全，请使用 HTTPS 或 localhost"
        );

        addLog(
            "连接失败：网页环境不安全",
            "ERR"
        );

        showToast("请在 HTTPS 或 localhost 中打开");
        return;
    }

    if (!navigator.bluetooth) {
        setConnectionState(
            "error",
            "浏览器不支持 Web Bluetooth"
        );

        addLog(
            "连接失败：浏览器不支持 Web Bluetooth",
            "ERR"
        );

        showToast("当前浏览器不支持 Web Bluetooth");
        return;
    }

    try {
        connectionStatus.textContent =
            "等待选择蓝牙设备……";

        addLog("开始尝试蓝牙连接");

        const name = await ble.connect(
            handleDeviceData,
            handleUnexpectedDisconnect
        );

        useSimulation = false;

        setConnectionState(
            "connected",
            "已连接设备：" + name
        );

        deviceName.textContent = name;

        updateModeNotice(
            "真实设备模式：指令将发送到蓝牙硬件"
        );

        deviceFeedback.textContent =
            "已建立连接，等待设备反馈";

        addLog("蓝牙连接成功：" + name, "OK");
        showToast("已连接 " + name);

        updateLedDisplay(ledIsOn);
    } catch (error) {
        setConnectionState(
            "error",
            "未连接真实设备，请检查蓝牙模块"
        );

        addLog(
            "蓝牙连接失败：" + error.message,
            "ERR"
        );

        showToast("未连接真实设备");
    }
}

function handleUnexpectedDisconnect() {
    useSimulation = false;

    setConnectionState(
        "error",
        "蓝牙意外断开，请重新连接"
    );

    updateModeNotice(
        "真实设备模式：连接已断开，请重新连接"
    );

    deviceFeedback.textContent =
        "设备连接已断开，等待重新连接";

    addLog(
        "蓝牙意外断开，请重新连接",
        "ERR"
    );
}

/* =========================
   10. LED 指令
   ========================= */

async function sendLedCommand(isOn) {
    if (useSimulation) {
        updateLedDisplay(isOn);

        addLog(
            "LED " +
            (isOn ? "开启" : "关闭") +
            "（模拟），未发送到硬件"
        );

        showToast("模拟反馈已更新");
        return;
    }

    try {
        const command = isOn
            ? "LED_ON\n"
            : "LED_OFF\n";

        await ble.send(command);

        deviceFeedback.textContent =
            "已发送指令，等待设备确认";

        addLog(
            "已发送 " + command.trim() +
            "，等待硬件反馈",
            "TX"
        );
    } catch (error) {
        deviceFeedback.textContent =
            "指令发送失败";

        addLog(
            "指令发送失败：" + error.message,
            "ERR"
        );
    }
}

/* =========================
   11. 专注计时
   ========================= */

function renderFocusTimer() {
    const minutes = String(
        Math.floor(focusSeconds / 60)
    ).padStart(2, "0");

    const seconds = String(
        focusSeconds % 60
    ).padStart(2, "0");

    const timeText = minutes + ":" + seconds;

    $("timer-display").textContent = timeText;
    $("focus-time").textContent = timeText;
}

function startFocusTimer() {
    if (focusTimer) {
        clearInterval(focusTimer);
        focusTimer = null;

        $("start-focus").textContent = "继续专注";
        addLog("专注计时已暂停");
        return;
    }

    $("start-focus").textContent = "暂停专注";
    addLog("开始专注计时（本地）");
    showToast("专注已开始");

    focusTimer = setInterval(() => {
        if (focusSeconds <= 0) {
            clearInterval(focusTimer);
            focusTimer = null;

            $("start-focus").textContent =
                "开始专注";

            addLog("专注时段完成", "DONE");
            showToast("专注时段完成");
            return;
        }

        focusSeconds -= 1;
        renderFocusTimer();
    }, 1000);
}

function resetFocusTimer() {
    clearInterval(focusTimer);

    focusTimer = null;
    focusSeconds = Number($("focus-range").value) * 60;

    $("start-focus").textContent = "开始专注";

    renderFocusTimer();
    addLog("专注计时已重置");
}

/* =========================
   12. 课表
   ========================= */

function loadCourses() {
    try {
        const saved = localStorage.getItem("focus-courses");
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        return [];
    }
}

function saveCourses() {
    localStorage.setItem("focus-courses", JSON.stringify(courses));
}

function openCourseModal() {
    $("course-modal").classList.add("show");
    $("course-modal").setAttribute("aria-hidden", "false");
    $("course-day").value = selectedCourseDay;
    $("course-name").focus();
}

function closeCourseModal() {
    $("course-modal").classList.remove("show");
    $("course-modal").setAttribute("aria-hidden", "true");
}

function getCoursesForDay(day) {
    return courses
        .filter((course) => course.day === day)
        .sort((a, b) => a.start.localeCompare(b.start));
}

function createCourseRow(course) {
    const row = document.createElement("div");
    const time = document.createElement("div");
    const details = document.createElement("div");
    const name = document.createElement("strong");
    const meta = document.createElement("small");
    const deleteButton = document.createElement("button");

    row.className = "course-row";
    time.className = "course-time";
    details.className = "course-details";
    deleteButton.className = "course-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "删除";

    time.textContent = course.start + " — " + course.end;
    name.textContent = course.name;
    meta.textContent = course.note
        ? course.day + " · " + course.note
        : course.day;

    deleteButton.addEventListener("click", () => {
        courses = courses.filter((item) => item.id !== course.id);
        saveCourses();
        renderCourseLists();
        addLog("删除课程：" + course.name, "OK");
        showToast("课程已删除");
    });

    details.append(name, meta);
    row.append(time, details, deleteButton);
    return row;
}

function renderCourseLists() {
    const scheduleList = $("schedule-list");
    const todayCourses = $("today-courses");
    const selectedCourses = getCoursesForDay(selectedCourseDay);
    const todayCoursesList = getCoursesForDay(todayDay);

    scheduleList.replaceChildren();
    todayCourses.replaceChildren();

    if (selectedCourses.length === 0) {
        scheduleList.innerHTML =
            '<div class="empty left"><i>▦</i><div><b>' +
            selectedCourseDay +
            '没有课程安排</b><p>添加课程后，提醒与专注计划会自动关联。</p></div></div>';
    } else {
        selectedCourses.forEach((course) => {
            scheduleList.append(createCourseRow(course));
        });
    }

    if (todayCoursesList.length === 0) {
        todayCourses.innerHTML =
            '<div class="empty"><i>☼</i><div><b>今天没有安排课程</b><p>新增一节课，让设备提醒和专注计时跟着你的计划走。</p></div><button class="outline-button" id="empty-add-course">添加课程</button></div>';
        $("empty-add-course").addEventListener("click", openCourseModal);
    } else {
        todayCoursesList.forEach((course) => {
            todayCourses.append(createCourseRow(course));
        });
    }
}

function hasTimeConflict(course) {
    return getCoursesForDay(course.day).some((item) => {
        return course.start < item.end && course.end > item.start;
    });
}

function saveCourse(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const course = {
        id: String(Date.now()),
        name: String(formData.get("courseName")).trim(),
        day: String(formData.get("courseDay")),
        start: String(formData.get("courseStart")),
        end: String(formData.get("courseEnd")),
        note: String(formData.get("courseNote") || "").trim()
    };

    if (!course.name) {
        showToast("请填写课程名称");
        return;
    }

    if (course.end <= course.start) {
        showToast("结束时间需要晚于开始时间");
        return;
    }

    if (hasTimeConflict(course)) {
        showToast("这一天已有时间重叠的课程");
        return;
    }

    courses.push(course);
    saveCourses();
    selectedCourseDay = course.day;
    updateCourseTabs();
    renderCourseLists();
    addLog("新增课程：" + course.day + " " + course.name, "OK");
    closeCourseModal();
    form.reset();
    $("course-day").value = selectedCourseDay;
    $("course-start").value = "14:00";
    $("course-end").value = "15:40";
    showToast("课程已添加");
}

function updateCourseTabs() {
    document.querySelectorAll(".tab[data-day]").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.day === selectedCourseDay);
    });
}

/* =========================
   13. 事件绑定
   ========================= */

document
    .querySelectorAll("[data-view]")
    .forEach((button) => {
        button.addEventListener("click", () => {
            switchView(button.dataset.view);
        });
    });

$("connect-btn").addEventListener(
    "click",
    connectBluetooth
);

$("connect-btn-secondary").addEventListener(
    "click",
    connectBluetooth
);

$("disconnect-btn").addEventListener(
    "click",
    () => {
        ble.disconnect();

        useSimulation = true;

        setConnectionState(
            "disconnected",
            "模拟模式 · 未连接"
        );

        updateModeNotice(
            "当前为模拟模式，操作不会控制真实硬件"
        );

        deviceFeedback.textContent =
            "尚未收到设备反馈";

        updateLedDisplay(ledIsOn);

        addLog(
            "用户主动断开蓝牙，切换为模拟模式"
        );

        showToast("已切换到模拟模式");
    }
);

$("led-on-btn").addEventListener(
    "click",
    () => sendLedCommand(true)
);

$("device-led-on").addEventListener(
    "click",
    () => sendLedCommand(true)
);

$("led-off-btn").addEventListener(
    "click",
    () => sendLedCommand(false)
);

$("lampBtn").addEventListener(
    "click",
    () => {
        lampIsOn = !lampIsOn;

        $("lamp-status").textContent =
            lampIsOn
                ? "已开启 · 柔光模式"
                : "已关闭 · 等待指令";

        $("lampBtn").querySelector("em").textContent =
            lampIsOn ? "ON" : "OFF";

        addLog(
            "桌面台灯已" +
            (lampIsOn ? "开启" : "关闭") +
            "（模拟）"
        );
    }
);

$("testReminder").addEventListener(
    "click",
    () => {
        addLog("提醒测试已触发（模拟）", "BEEP");
        showToast("提醒测试已触发");
    }
);

$("clear-log-btn").addEventListener(
    "click",
    () => {
        operationLog.innerHTML = "";
        addLog("操作日志已清空");
    }
);

$("start-focus").addEventListener(
    "click",
    startFocusTimer
);

$("reset-focus").addEventListener(
    "click",
    resetFocusTimer
);

$("focus-range").addEventListener(
    "input",
    (event) => {
        $("focus-range-value").textContent =
            event.target.value + " 分钟";

        if (!focusTimer) {
            focusSeconds =
                Number(event.target.value) * 60;
            renderFocusTimer();
        }
    }
);

$("break-range").addEventListener(
    "input",
    (event) => {
        $("break-range-value").textContent =
            event.target.value + " 分钟";
    }
);

$("sound-range").addEventListener(
    "input",
    (event) => {
        $("sound-range-value").textContent =
            event.target.value + " 秒";
    }
);

$("save-reminders").addEventListener(
    "click",
    () => {
        addLog(
            "蜂鸣器提醒配置已保存（本地）",
            "OK"
        );

        showToast("提醒配置已保存");
    }
);

$("lock-btn").addEventListener(
    "click",
    () => {
        addLog(
            "电控锁控制入口已打开，等待锁体与执行机构验证",
            "WAIT"
        );

        showToast("真实电控锁待硬件验证");
        switchView("device");
    }
);

$("add-course-btn").addEventListener(
    "click",
    openCourseModal
);

$("empty-add-course")?.addEventListener(
    "click",
    openCourseModal
);

document.querySelectorAll(".tab[data-day]").forEach((tab) => {
    tab.addEventListener("click", () => {
        selectedCourseDay = tab.dataset.day;
        updateCourseTabs();
        renderCourseLists();
    });
});

$("close-course-modal").addEventListener(
    "click",
    closeCourseModal
);

$("cancel-course").addEventListener(
    "click",
    closeCourseModal
);

$("course-modal").addEventListener(
    "click",
    (event) => {
        if (event.target.id === "course-modal") {
            closeCourseModal();
        }
    }
);

$("course-form").addEventListener(
    "submit",
    saveCourse
);

/* =========================
   14. 页面初始化
   ========================= */

function updateClock() {
    $("clock").textContent =
        new Date().toLocaleTimeString(
            "zh-CN",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );
}

setInterval(updateClock, 1000);

updateClock();
renderFocusTimer();
updateCourseTabs();
renderCourseLists();

setConnectionState(
    "disconnected",
    "模拟模式 · 未连接"
);

updateLedDisplay(false);
addLog("控制台已启动，当前为模拟模式");

