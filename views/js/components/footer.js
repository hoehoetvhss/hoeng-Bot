const githubLink = document.createElement("a");
githubLink.href = "https://discord.gg/HMFyw4xeeV";
githubLink.innerHTML = `Copyright &copy; 2023-${new Date().getFullYear()} hoeeg Bot`;
githubLink.style.textDecoration = "none";
githubLink.style.color = "inherit";
githubLink.target = "_blank";

githubLink.addEventListener("mouseover", () => {
    githubLink.style.color = "#0056b3"; // 懸停顏色
});

githubLink.addEventListener("mouseout", () => {
    githubLink.style.color = "inherit"; // 原始顏色
});


const body = document.body;
body.appendChild(document.createElement("footer"));

const footer = document.querySelector("footer");
footer.style.textAlign = "center";
footer.style.padding = "10px";

const copyrightText = document.createElement("p");
copyrightText.id = "copyright";
copyrightText.appendChild(githubLink);

footer.appendChild(copyrightText);