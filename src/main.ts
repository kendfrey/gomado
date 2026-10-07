import { type BoardContents, type BoardStyle, drawBoard, enableAutoRender } from "./lib";
import "./style.css";

const demos: Record<string, () => void> = {
	demo1: demo1,
	random: randomDemo,
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
	drawBoard(canvas, { width: 19, height: 19, stones: { black: [[16, 3], [15, 15]], white: [[3, 3], [3, 15]] } });
}

function randomDemo()
{
	const contents: BoardContents = { width: 19, height: 19, stones: {} };
	if (Math.random() < 0.5)
	{
		if (Math.random() < 0.5)
		{
			if (Math.random() < 0.5)
			{
				contents.width = 9;
				contents.height = 9;
			}
			else
			{
				contents.width = 13;
				contents.height = 13;
			}
		}
		else
		{
			contents.width = Math.floor(Math.random() * 30) + 1;
			contents.height = Math.floor(Math.random() * 30) + 1;
		}
	}
	if (Math.random() < 0.5)
		contents.stones.black = [];
	if (Math.random() < 0.5)
		contents.stones.white = [];
	if (Math.random() < 0.1)
		contents.stones.red = [];
	if (Math.random() < 0.1)
		contents.stones.green = [];
	if (Math.random() < 0.1)
		contents.stones.blue = [];
	if (Math.random() < 0.1)
		contents.stones.yellow = [];
	const collections = Object.values(contents.stones);
	if (collections.length > 0)
	{
		for (let y = 0; y < contents.height; y++)
		{
			for (let x = 0; x < contents.width; x++)
			{
				if (Math.random() < 0.1)
				{
					const collection = collections[Math.floor(Math.random() * collections.length)];
					collection.push([x, y]);
				}
			}
		}
	}

	const style: Partial<BoardStyle> = {};
	if (Math.random() < 0.5)
		style.backgroundColour = randomColour();
	if (Math.random() < 0.5)
		style.woodColour = Math.random() < 0.5 ? randomColour() : null;
	if (Math.random() < 0.5)
		style.woodScale = Math.tan(Math.random() * Math.PI * 0.5);
	if (Math.random() < 0.5)
		style.lineColour = randomColour();
	if (Math.random() < 0.5)
	{
		style.starPoints = [];
		const num = Math.floor(Math.random() * 10);
		for (let i = 0; i < num; i++)
		{
			style.starPoints.push([
				Math.floor(Math.random() * contents.width),
				Math.floor(Math.random() * contents.height),
			]);
		}
	}

	drawBoard(canvas, contents, style);

	function randomColour()
	{
		return `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, "0")}`;
	}
}
