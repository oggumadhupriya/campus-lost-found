
document.addEventListener("DOMContentLoaded", () => {
    loadAdminStats();
    loadClaims();

    document.getElementById("logoutBtn").addEventListener("click", logout);
});

// =====================================
// LOAD ADMIN STATISTICS
// =====================================

async function loadAdminStats() {
    try {
        const response = await fetch("/api/admin/stats", {
            credentials: "include"
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load statistics.");
        }

        document.getElementById("totalUsers").textContent =
            data.stats.totalUsers;

        document.getElementById("totalItems").textContent =
            data.stats.totalItems;

        document.getElementById("totalClaims").textContent =
            data.stats.totalClaims;

        document.getElementById("recoveredItems").textContent =
            data.stats.recoveredItems;

    } catch (error) {
        console.error("Statistics error:", error);
        document.getElementById("message").textContent =
            error.message;
    }
}

// =====================================
// LOAD CLAIMS
// =====================================

async function loadClaims() {
    const container = document.getElementById("claimsContainer");

    try {
        container.innerHTML = "<p>Loading claims...</p>";

        // Get all items
        const itemsResponse = await fetch("/api/items", {
            credentials: "include"
        });

        const itemsData = await itemsResponse.json();

        if (!itemsResponse.ok) {
            throw new Error(itemsData.message || "Could not load items.");
        }

        const items = Array.isArray(itemsData)
            ? itemsData
            : itemsData.items || [];

        if (items.length === 0) {
            container.innerHTML = "<p>No items found.</p>";
            return;
        }

        // Get claims for each item
        const results = await Promise.all(
            items.map(async (item) => {
                try {
                    const itemId = item._id || item.id;

                    const response = await fetch(
                        `/api/items/${itemId}/claims`,
                        { credentials: "include" }
                    );

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        return [];
                    }

                    return (data.claims || []).map(claim => ({
                        ...claim,
                        itemName: item.name || "Unknown Item"
                    }));

                } catch (error) {
                    console.error("Could not load item claims:", error);
                    return [];
                }
            })
        );

        const claims = results.flat();

        if (claims.length === 0) {
            container.innerHTML = "<p>No claims available.</p>";
            return;
        }

        displayClaims(claims);

    } catch (error) {
        console.error("Claims loading error:", error);

        container.innerHTML =
            `<p>Could not load claims: ${escapeHTML(error.message)}</p>`;
    }
}

// =====================================
// DISPLAY CLAIMS
// =====================================

function displayClaims(claims) {
    const container = document.getElementById("claimsContainer");

    container.innerHTML = "";

    claims.forEach(claim => {
        const card = document.createElement("div");
        card.className = "stat-card";

        const status = String(claim.status || "pending").toLowerCase();

        card.innerHTML = `
            <h3>${escapeHTML(claim.itemName)}</h3>

            <p><strong>Claimant:</strong>
                ${escapeHTML(claim.claimantName || "Unknown")}
            </p>

            <p><strong>Message:</strong>
                ${escapeHTML(claim.message || "")}
            </p>

            <p><strong>Status:</strong>
                ${escapeHTML(status)}
            </p>

            <div class="claim-actions"></div>
        `;

        const actions = card.querySelector(".claim-actions");

        if (status === "pending") {
            const approveButton = document.createElement("button");
            approveButton.textContent = "Approve";
            approveButton.addEventListener("click", () => {
                reviewClaim(claim._id, "approved");
            });

            const rejectButton = document.createElement("button");
            rejectButton.textContent = "Reject";
            rejectButton.addEventListener("click", () => {
                reviewClaim(claim._id, "rejected");
            });

            actions.append(approveButton, rejectButton);
        }

        container.appendChild(card);
    });
}

// =====================================
// APPROVE OR REJECT CLAIM
// =====================================

async function reviewClaim(claimId, status) {
    try {
        const response = await fetch(
            `/api/claims/${claimId}/review`,
            {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ status })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not review claim.");
        }

        alert(data.message);

        await loadClaims();
        await loadAdminStats();

    } catch (error) {
        console.error("Review claim error:", error);
        alert(error.message);
    }
}

// =====================================
// LOGOUT
// =====================================

async function logout() {
    try {
        const response = await fetch("/api/logout", {
            method: "POST",
            credentials: "include"
        });

        const data = await response.json();

        if (response.ok && data.success) {
            window.location.href = "index.html";
        } else {
            alert(data.message || "Logout failed.");
        }

    } catch (error) {
        console.error("Logout error:", error);
        alert("Could not log out.");
    }
}

// =====================================
// HTML ESCAPE
// =====================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}
