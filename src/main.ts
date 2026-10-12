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
	drawBoard(canvas, {
		width: 19,
		height: 19,
		stones: {
			black: [
				[2, 3],
				[2, 10],
				[2, 13],
				[3, 2],
				[3, 10],
				[4, 3],
				[4, 9],
				[4, 15],
				[5, 2],
				[5, 7],
				[5, 8],
				[5, 10],
				[6, 5],
				[6, 6],
				[7, 2],
				[7, 3],
				[7, 4],
				[7, 9],
				[8, 16],
				[9, 8],
				[10, 10],
				[11, 5],
				[11, 7],
				[11, 8],
				[12, 3],
				[12, 4],
				[12, 6],
				[12, 7],
				[12, 15],
				[13, 1],
				[13, 2],
				[13, 3],
				[13, 8],
				[13, 9],
				[13, 16],
				[14, 9],
				[14, 15],
				[15, 3],
				[15, 9],
			],
			white: [
				[1, 9],
				[1, 15],
				[2, 6],
				[2, 9],
				[3, 9],
				[3, 15],
				[4, 2],
				[4, 7],
				[4, 8],
				[4, 14],
				[5, 3],
				[5, 5],
				[5, 6],
				[5, 15],
				[5, 16],
				[6, 4],
				[6, 7],
				[8, 3],
				[8, 10],
				[9, 6],
				[10, 8],
				[11, 2],
				[12, 2],
				[12, 5],
				[12, 8],
				[12, 9],
				[12, 10],
				[13, 4],
				[13, 5],
				[13, 6],
				[13, 7],
				[14, 8],
				[14, 16],
				[15, 8],
				[15, 14],
				[15, 16],
				[16, 8],
				[16, 9],
				[16, 15],
			],
		},
		labels: [
			[[6, 5], "triangle"],
			[[6, 6], "triangle"],
			[[8, 3], "square"],
			[[11, 2], "square"],
			[[12, 2], "square"],
			[[13, 8], "cross"],
			[[13, 9], "cross"],
			[[14, 9], "cross"],
			[[15, 9], "cross"],
			[[4, 2], "circle"],
			[[4, 15], "circle"],
			[[6, 8], "A"],
			[[8, 8], "B"],
			[[9, 7], "C"],
			[[15, 3], "1"],
			[[3, 15], "2"],
			[[2, 3], "3"],
			[[16, 15], "4"],
			[[7, 9], "73"],
		],
	});
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
	if (Math.random() < 0.5)
		contents.labels = [];
	const collections = Object.values(contents.stones);
	const symbols = ["circle", "cross", "square", "triangle"];
	const coordLocations = ["all", "none", "top-left", "bottom-left", "top-right", "bottom-right"] as const;
	for (let y = 0; y < contents.height; y++)
	{
		for (let x = 0; x < contents.width; x++)
		{
			if (collections.length > 0 && Math.random() < 0.25)
			{
				const collection = collections[Math.floor(Math.random() * collections.length)];
				collection.push([x, y]);
			}
			if (contents.labels && Math.random() < 0.1)
			{
				const label = Math.random() < 0.5
					? (Math.random() < 0.5
						? String.fromCharCode(65 + Math.floor(Math.random() * 26))
						: String(Math.floor(Math.random() ** 2 * 99 + 1)))
					: symbols[Math.floor(Math.random() * symbols.length)];
				contents.labels.push([[x, y], label]);
			}
		}
	}

	const style: Partial<BoardStyle> = {};
	if (Math.random() < 0.5)
		style.backgroundColour = randomColour();
	if (Math.random() < 0.5)
		style.woodColour = Math.random() < 0.5 ? randomColour() : null;
	if (Math.random() < 0.5)
		style.woodScale = Math.tan(Math.random() * Math.PI * 0.5) + 1;
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
	if (Math.random() < 0.5)
		style.margin = Math.max(0, Math.min(1, Math.random() * 1.5 - 0.25));
	if (Math.random() < 0.5)
		style.coords = "kanji";
	style.coordsLocation = coordLocations[Math.floor(Math.random() * coordLocations.length)];
	if (Math.random() < 0.1)
		style.fontFace = "Comic Sans MS";

	drawBoard(canvas, contents, style);

	function randomColour()
	{
		return `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, "0")}`;
	}
}
