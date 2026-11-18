// =====================================
// 1. Store items and current user
// =====================================

let items = [];
let currentUser = null;


// =====================================
// 2. Get HTML Elements
// =====================================

const itemsContainer = document.getElementById("itemsContainer");
const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const emptyMessage = document.getElementById("emptyMessage");

const reportForm = document.getElementById("reportForm");
const formMessage = document.getElementById("formMessage");


// =====================================
// 3. Create Claims Section
// =====================================

const claimsSection = document.createElement("section");
claimsSection.id = "claimsSection";
claimsSection.className = "claims-section";

claimsSection.innerHTML = `
    <h2>Claims and Recovery Tracking</h2>

    <button type="button" id="myClaimsButton">
        My Submitted Claims
    </button>

    <div id="claimsMessage"></div>
    <div id="claimsContainer"></div>
`;

itemsContainer.insertAdjacentElement("afterend", claimsSection);

const myClaimsButton = document.getElementById("myClaimsButton");
const claimsMessage = document.getElementById("claimsMessage");
const claimsContainer = document.getElementById("claimsContainer");


// =====================================
// 4. Get Current Logged-in User
// =====================================


async function loadCurrentUser() {
    try {
        const response = await fetch("/api/me");
        const data = await response.json();

        const loginLink = document.getElementById("loginLink");
        const registerLink = document.getElementById("registerLink");
        const welcomeMessage = document.getElementById("welcomeMessage");
        const logoutButton = document.getElementById("logoutButton");

        if (response.ok && data.success) {
            currentUser = data.user;

            loginLink.style.display = "none";
            registerLink.style.display = "none";

            welcomeMessage.textContent =
                "Welcome, " + currentUser.name;

            logoutButton.style.display = "inline-block";

        } else {
            currentUser = null;

            loginLink.style.display = "inline";
            registerLink.style.display = "inline";

            welcomeMessage.textContent = "";
            logoutButton.style.display = "none";
        }

    } catch (error) {
        console.error("Login check error:", error);
        currentUser = null;
    }
}


const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", async function () {
        try {
            const response = await fetch("/api/logout", {
                method: "POST"
            });

            const data = await response.json();

            if (response.ok && data.success) {
                window.location.reload();
            } else {
                alert(data.message || "Logout failed.");
            }

        } catch (error) {
            console.error("Logout error:", error);
            alert("Unable to logout. Please try again.");
        }
    });
}


// =====================================
// 5. Display Items
// =====================================


function displayItems() {

    const keyword = searchInput.value.toLowerCase().trim();
    const selectedType = typeFilter.value;

    const filteredItems = items.filter(item => {

        const searchableText =
            `${item.name} ${item.category} ${item.location} ${item.description}`;

        const matchesKeyword =
            searchableText.toLowerCase().includes(keyword);

        const matchesType =
            selectedType === "all" || item.type === selectedType;

        return matchesKeyword && matchesType;
    });

    itemsContainer.replaceChildren();

    filteredItems.forEach(item => {

        const card = document.createElement("article");
        card.className = "item-card";

        // Display uploaded image
        if (item.image) {

            const image = document.createElement("img");

            image.src = "/uploads/" + encodeURIComponent(item.image);
            image.alt = item.name;
            image.className = "item-image";
            image.loading = "lazy";

            card.appendChild(image);
        }

        const title = document.createElement("h3");
        title.textContent = item.name;

        const type = document.createElement("p");
        type.className = "item-type";
        type.textContent = item.type;

        const category = document.createElement("p");
        category.textContent = "Category: " + item.category;

        const location = document.createElement("p");
        location.textContent = "Location: " + item.location;

        const description = document.createElement("p");
        description.textContent = item.description;

        const date = document.createElement("p");
        date.textContent = "Date: " + (item.date || "Not specified");

        const recovery = document.createElement("p");
        recovery.textContent =
            "Recovery Status: " +
            (item.recoveryStatus || "Not recovered");

        card.append(
            title,
            type,
            category,
            location,
            description,
            date,
            recovery
        );

        // Claim and review buttons for found items

        if (item.type === "Found") {

            const isOwner =
                currentUser &&
                item.reportedBy === currentUser.id;

            if (isOwner) {

                const reviewButton = document.createElement("button");
                reviewButton.textContent = "View Claims";

                reviewButton.addEventListener("click", () => {
                    viewItemClaims(item);
                });

                card.appendChild(reviewButton);

            } else {

                const claimButton = document.createElement("button");

                claimButton.textContent = "Claim Item";

                claimButton.disabled =
                    item.recoveryStatus === "Recovered";

                claimButton.addEventListener("click", () => {
                    submitClaim(item);
                });

                card.appendChild(claimButton);
            }
        }

        itemsContainer.appendChild(card);
    });

    emptyMessage.hidden = filteredItems.length !== 0;
}



// =====================================
// 6. Load Items from MongoDB
// =====================================

async function loadItems() {

    try {

        const response = await fetch("/api/items");
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not retrieve items.");
        }

        items = data.items || [];

        displayItems();

    } catch (error) {

        console.error("Error loading items:", error);

        formMessage.textContent =
            "Could not load items. Please check your server.";

    }
}


// =====================================
// 7. Submit a Claim
// =====================================

async function submitClaim(item) {

    if (!currentUser) {
        alert("Please log in before submitting a claim.");
        return;
    }

    const message = prompt(
        "Explain why this item belongs to you:"
    );

    if (message === null) {
        return;
    }

    if (!message.trim()) {
        alert("Please enter a message for your claim.");
        return;
    }

    try {

        const response = await fetch(
            `/api/items/${item._id}/claims`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: message.trim()
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Claim submission failed.");
        }

        alert("Your claim was submitted successfully!");

        await viewMyClaims();

    } catch (error) {

        console.error("Claim error:", error);
        alert(error.message);

    }
}


// =====================================
// 8. View My Submitted Claims
// =====================================

async function viewMyClaims() {

    claimsMessage.textContent = "Loading your claims...";
    claimsContainer.replaceChildren();

    try {

        const response = await fetch("/api/my-claims");
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load claims.");
        }

        claimsMessage.textContent = "";

        if (!data.claims || data.claims.length === 0) {
            claimsMessage.textContent = "You have not submitted any claims.";
            return;
        }

        data.claims.forEach(claim => {

            const card = document.createElement("article");
            card.className = "claim-card";

            const title = document.createElement("h3");
            title.textContent =
                claim.item ? claim.item.name : "Item unavailable";

            const message = document.createElement("p");
            message.textContent = "Your message: " + claim.message;

            const status = document.createElement("p");
            status.textContent =
                "Claim Status: " + claim.status.toUpperCase();

            const recovery = document.createElement("p");
            recovery.textContent =
                "Recovery Status: " +
                (claim.item
                    ? claim.item.recoveryStatus
                    : "Unknown");

            card.append(title, message, status, recovery);

            claimsContainer.appendChild(card);
        });

    } catch (error) {

        claimsMessage.textContent = error.message;

    }
}


// =====================================
// 9. View Claims for My Reported Item
// =====================================

async function viewItemClaims(item) {

    claimsMessage.textContent = "Loading item claims...";
    claimsContainer.replaceChildren();

    try {

        const response = await fetch(
            `/api/items/${item._id}/claims`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load item claims.");
        }

        claimsMessage.textContent =
            "Claims for: " + item.name;

        if (!data.claims || data.claims.length === 0) {
            claimsContainer.textContent =
                "No claims have been submitted for this item.";
            return;
        }

        data.claims.forEach(claim => {

            const card = document.createElement("article");
            card.className = "claim-card";

            const name = document.createElement("h3");
            name.textContent = "Claimant: " + claim.claimantName;

            const message = document.createElement("p");
            message.textContent = "Message: " + claim.message;

            const status = document.createElement("p");
            status.textContent =
                "Status: " + claim.status.toUpperCase();

            card.append(name, message, status);

            if (claim.status === "pending") {

                const approveButton = document.createElement("button");
                approveButton.textContent = "Approve";

                approveButton.addEventListener("click", () => {
                    reviewClaim(claim._id, "approved", item);
                });

                const rejectButton = document.createElement("button");
                rejectButton.textContent = "Reject";

                rejectButton.addEventListener("click", () => {
                    reviewClaim(claim._id, "rejected", item);
                });

                card.append(approveButton, rejectButton);
            }

            claimsContainer.appendChild(card);
        });

    } catch (error) {

        console.error("View claims error:", error);
        claimsMessage.textContent = error.message;

    }
}


// =====================================
// 10. Approve or Reject a Claim
// =====================================

async function reviewClaim(claimId, status, item) {

    const confirmed = confirm(
        `Are you sure you want to ${status} this claim?`
    );

    if (!confirmed) {
        return;
    }

    try {

        const response = await fetch(
            `/api/claims/${claimId}/review`,
            {
                method: "PATCH",
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

        await loadItems();
        await viewItemClaims(item);

    } catch (error) {

        console.error("Review claim error:", error);
        alert(error.message);

    }
}


// =====================================
// 11. My Claims Button
// =====================================

myClaimsButton.addEventListener("click", viewMyClaims);


// =====================================
// 12. Search and Filter Events
// =====================================

searchInput.addEventListener("input", displayItems);

typeFilter.addEventListener("change", displayItems);


// =====================================
// 13. Report Form Submission
// =====================================


reportForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const itemName =
        document.getElementById("itemName").value.trim();

    const selectedType =
        document.getElementById("itemType").value;

    const itemType =
        selectedType.trim().toLowerCase() === "lost"
            ? "Lost"
            : selectedType.trim().toLowerCase() === "found"
                ? "Found"
                : "";

    const category =
        document.getElementById("category").value;

    const description =
        document.getElementById("description").value.trim();

    const location =
        document.getElementById("location").value.trim();

    const itemDate =
        document.getElementById("itemDate").value;

    const imageFile =
        document.getElementById("itemImage").files[0];

    if (
        !itemName ||
        !itemType ||
        !category ||
        !description ||
        !location ||
        !itemDate
    ) {
        formMessage.textContent =
            "Please complete all required fields.";
        return;
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    const todayString = `${year}-${month}-${day}`;

    if (itemDate > todayString) {
        formMessage.textContent =
            "Please select a date that is not in the future.";
        return;
    }

    if (imageFile && imageFile.size > 5 * 1024 * 1024) {
        formMessage.textContent =
            "The image must be 5 MB or smaller.";
        return;
    }

    const formData = new FormData();

    formData.append("name", itemName);
    formData.append("category", category);
    formData.append("location", location);
    formData.append("type", itemType);
    formData.append("description", description);
    formData.append("date", itemDate);

    if (imageFile) {
        formData.append("itemImage", imageFile);
    }

    try {

        formMessage.textContent = "Saving your report...";

        const response = await fetch("/api/items", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not save your report.");
        }

        await loadItems();

        formMessage.textContent =
            "Report saved successfully!";

        reportForm.reset();

        document.getElementById("items").scrollIntoView({
            behavior: "smooth"
        });

    } catch (error) {

        console.error("Error saving report:", error);

        formMessage.textContent =
            error.message || "Something went wrong. Please try again.";

    }

});


 
// =====================================
// 14. STUDENT LOGIN
// =====================================

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const loginMessage = document.getElementById("loginMessage");

        try {

            loginMessage.textContent = "Logging in...";

            const response = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Login failed.");
            }

            loginMessage.textContent = "Login successful!";

            window.location.href = "/index.html";

        } catch (error) {

            console.error("Login error:", error);

            loginMessage.textContent =
                error.message || "Unable to login. Please try again.";
        }

    });

}


// =====================================
// 15. INITIAL DISPLAY
// =====================================

async function initializeApp() {

    await loadCurrentUser();
    await loadItems();

}

if (itemsContainer) {
    initializeApp();
}
