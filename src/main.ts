import { drawBoard, enableAutoRender } from "./lib";
import "./style.css";

const demos: Record<string, () => void> = {
	demo1: demo1,
	demo2: demo2,
};

const demosContainer = document.querySelector<HTMLDivElement>("#demos")!;
const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
enableAutoRender(canvas);

for (const key in demos)
{
	const btn = document.createElement("button");
	btn.textContent = key;
	btn.addEventListener("click", demos[key]);
	demosContainer.appendChild(btn);
}

function demo1()
{
	drawBoard(canvas, { width: 10, height: 10 });
}

function demo2()
{
	drawBoard(canvas, { width: 200, height: 100 });
}
