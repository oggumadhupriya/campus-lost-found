
// Student Registration
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const message = document.getElementById("message");

        try {
            const response = await fetch("/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify({
                    name,
                    email,
                    password
                })
            });

            const data = await response.json();

            if (response.ok) {
                message.textContent = "Registration successful!";
                message.style.color = "green";
                registerForm.reset();
            } else {
                message.textContent = data.message || "Registration failed.";
                message.style.color = "red";
            }

        } catch (error) {
            message.textContent = "Unable to connect to the server.";
            message.style.color = "red";
        }
    });
}


// Student Login
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const message = document.getElementById("loginMessage");

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const data = await response.json();

            if (response.ok) {
                message.textContent = "Login successful!";
                message.style.color = "green";

                window.location.href = "index.html";
            } else {
                message.textContent =
                    data.message || "Invalid email or password.";
                message.style.color = "red";
            }

        } catch (error) {
            message.textContent = "Unable to connect to the server.";
            message.style.color = "red";
        }
    });
}
