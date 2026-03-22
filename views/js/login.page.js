/**
 * Required
 * None
 */


document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const loginFailureMessage = document.getElementById("login-failure-message");
    const forgotPassword = document.getElementById("forgot-password");


    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;
        const data = {
            username: username,
            password: password
        };

        fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                return response.text();
            })
            .then((data) => {
                if (data === "SUCCEED") {
                    window.location.href = "/dashboard";
                }
                else if (data === "FAILED") {
                    loginFailureMessage.textContent = "사용자 아이디 또는 비밀번호가 올바르지 않습니다.";
                    loginFailureMessage.style.visibility = "visible";
                }
                else if (data === "BLOCKED_5") {
                    loginFailureMessage.textContent = "로그인 시도가 너무 많아 5분 동안 잠겼습니다.";
                    loginFailureMessage.style.visibility = "visible";
                }
            })
            .catch((error) => console.error("Error:", error));
    });


    forgotPassword.addEventListener("click", function () {
        alert("비밀번호는 .env 파일의 SITE_PASSWORD 값을 확인하세요.");
    });
});
