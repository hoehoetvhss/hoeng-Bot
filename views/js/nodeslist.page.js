/**
 * Required
 * None
 */


document.addEventListener("DOMContentLoaded", async () => {
    const nodesRefreshInterval = 10 * 1000; // 'api_nodes_status' 刷新時間 10s
    const nodeCollapseState = {};           // 節點清單的折疊狀態


    /**
     * Get nodes status
     */
    const getNodesStatus = async () => {
        const data = await (await fetch('/api/node/status')).json();

        const nodesArray = data;
        const nodeStatusList = document.getElementById("nodeStatusList");

        // 清空現有的節點狀態列表
        nodeStatusList.innerHTML = "";

        nodesArray.forEach((node) => {
            const nodeContainer = document.createElement("div");
            nodeContainer.className = "node-container";
            nodeContainer.textContent = `${node.id} [${node.state === 1 ? "연결됨" : node.state === 2 ? "연결 끊김" : "연결중"}] - ${node.ping}ms`;

            // 根據節點狀態設置樣式
            if (node.state === 0) { // CONNECTING
                nodeContainer.style.color = "#1ad1ff";
            }
            else if (node.state === 2) { // DISCONNECTED
                nodeContainer.style.color = "#fa2a2a";
            }
            else if (node.state === 1) { // CONNECTED
                nodeContainer.style.color = "#4AF626";

                const nodeContent = document.createElement("div");
                nodeContent.className = "node-content";
                nodeContent.innerHTML = `
                <div class="node-info-and-stats" style="color: black;">
                    <div class="info">
                        <h3>정보</h3>
                        <p>버전: <strong>${node.info.version.semver}</strong></p>
                        <p>JVM: <strong>${node.info.jvm}</strong></p>
                        <p>Lavaplayer: <strong>${node.info.lavaplayer}</strong></p>
                        <p>Git: <strong>${node.info.git.commit}</strong></p>
                        <p>빌드 시간: <strong>${timestampToTime(node.info.buildTime)}</strong></p>
                    </div>
                    <div class="stats">
                        <h3>상태</h3>
                        <p>가동시간: <strong>${msToTime(node.stats.uptime)}</strong></p>
                        <p>청취자: <strong>${node.stats.players}</strong></p>
                        <p>재생중: <strong>${node.stats.playingPlayers}</strong></p>
                    </div>
                </div>
                <div class="node-cpu-and-memory" style="color: black;">
                    <div class="cpu">
                        <h3>CPU</h3>
                        <p>코어: <strong>${node.stats.cpu.cores}</strong></p>
                        <p>시스템 로드: <strong>${node.stats.cpu.systemLoad.toFixed(6)}</strong></p>
                        <p>Lavalink 로드: <strong>${node.stats.cpu.lavalinkLoad.toFixed(6)}</strong></p>
                    </div>
                    <div class="memory">
                        <h3>메모리</h3>
                        <p>사용중: <strong>${formatBytes(node.stats.memory.used)}</strong></p>
                        <p>사용 가능: <strong>${formatBytes(node.stats.memory.free)}</strong></p>
                        <p>할당 가능: <strong>${formatBytes(node.stats.memory.allocated)}</strong></p>
                        <p>예약 가능: <strong>${formatBytes(node.stats.memory.reservable)}</strong></p>
                    </div>
                </div>
                `;

                // 初始化摺疊狀態
                if (nodeCollapseState[node.id] === undefined) {
                    nodeContent.style.display = "none";
                    nodeCollapseState[node.id] = "none";
                }
                nodeContent.style.display = nodeCollapseState[node.id];

                // 添加摺疊狀態點擊事件
                nodeContainer.addEventListener("click", function () {
                    if (nodeContent.style.display === "none") {
                        nodeContent.style.display = "block";
                        nodeCollapseState[node.id] = "block";
                    }
                    else {
                        nodeContent.style.display = "none";
                        nodeCollapseState[node.id] = "none";
                    }
                });

                // 將節點內容加入節點區塊中
                nodeContainer.appendChild(nodeContent);
            }

            // 將節點區塊添加到列表中
            nodeStatusList.appendChild(nodeContainer);
        });
    };
    await getNodesStatus();


    /**
     * nodes_status 刷新計時器
     */
    // ------------------------------------------------- //

    let nodesTimeLeft = nodesRefreshInterval / 1000;    // 計時器初始時間 (s)
    let countdownElement = document.getElementById("nodes-refresh-timer");

    const nodesRefreshTimer = async () => {
        countdownElement.innerHTML = `<span style="color: #ffffff; opacity: 0.3;"> ${nodesTimeLeft}초 뒤 새로고침 </span>`;

        if (nodesTimeLeft === 0) {
            nodesTimeLeft = nodesRefreshInterval / 1000;
            await getNodesStatus();
            // console.log('[emit] nodes_status');
        }
        else {
            nodesTimeLeft--;
        }
        setTimeout(nodesRefreshTimer, 1000);
    };
    nodesRefreshTimer();

    // ------------------------------------------------- //
});