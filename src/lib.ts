export type Coord = [number, number];

export interface BoardContents
{
	width: number;
	height: number;
	stones: Record<string, Coord[]>;
}

export interface BoardStyle
{
	backgroundColour: string;
	woodColour: string | null;
	woodScale: number;
	lineColour: string;
	starPoints: Coord[] | "auto";
}

const defaultStyle: BoardStyle = {
	backgroundColour: "#e6ba73",
	woodColour: "#dfad67",
	woodScale: 2,
	lineColour: "black",
	starPoints: "auto",
};

const boardContentsCache: WeakMap<HTMLCanvasElement, [BoardContents, Partial<BoardStyle> | undefined]> = new WeakMap();

export function enableAutoRender(canvas: HTMLCanvasElement): () => void
{
	const observer = new ResizeObserver(() =>
	{
		const cached = boardContentsCache.get(canvas);
		if (cached !== undefined)
			drawBoard(canvas, ...cached);
	});
	observer.observe(canvas);
	return () => observer.disconnect();
}

export function drawBoard(canvas: HTMLCanvasElement, contents: BoardContents, style?: Partial<BoardStyle>)
{
	boardContentsCache.set(canvas, [contents, style]);
	const w = canvas.width = canvas.clientWidth * devicePixelRatio;
	const h = canvas.height = canvas.clientHeight * devicePixelRatio;
	const ctx = canvas.getContext("2d")!;

	ctx.clearRect(0, 0, w, h);

	const margin = 0.1; // in stone units
	const s =
		Math.floor((Math.min(w / (contents.width + margin * 2), h / (contents.height + margin * 2)) + 1) * 0.5) * 2 - 1;
	const marginPx = Math.floor(margin * s);
	const boardWidth = contents.width * s + marginPx * 2;
	const boardHeight = contents.height * s + marginPx * 2;
	const boardX = Math.floor((w - boardWidth) * 0.5) + marginPx;
	const boardY = Math.floor((h - boardHeight) * 0.5) + marginPx;
	ctx.translate(boardX, boardY);
	ctx.beginPath();
	ctx.rect(-marginPx, -marginPx, boardWidth, boardHeight);
	ctx.clip();

	const fullStyle: BoardStyle = { ...defaultStyle, ...style };

	drawBackground();
	drawLines();
	drawStones();
	return;

	function drawBackground()
	{
		ctx.fillStyle = fullStyle.backgroundColour;
		ctx.fillRect(-marginPx, -marginPx, boardWidth, boardHeight);
		if (fullStyle.woodColour !== null)
		{
			const gradient = ctx.createLinearGradient(-marginPx, 0, -marginPx + boardWidth, 0);
			let a = boardWidth;
			for (let x = 0; x < boardWidth; x += fullStyle.woodScale * devicePixelRatio)
			{
				a = (a * 0x9E35) & 0xFFFF;
				const alpha = ((a ^ (a >> 8)) & 0xFF) / 255;
				gradient.addColorStop(x / boardWidth, `color(from ${fullStyle.woodColour} srgb r g b / ${alpha})`);
			}
			ctx.fillStyle = gradient;
			ctx.fillRect(-marginPx, -marginPx, boardWidth, boardHeight);
		}
	}

	function drawLines()
	{
		ctx.strokeStyle = fullStyle.lineColour;
		ctx.lineWidth = devicePixelRatio;
		ctx.lineCap = "square";
		ctx.beginPath();
		for (let y = 0; y < contents.height; y++)
		{
			const yPx = (y + 0.5) * s;
			ctx.moveTo(0.5 * s, yPx);
			ctx.lineTo((contents.width - 0.5) * s, yPx);
		}
		for (let x = 0; x < contents.width; x++)
		{
			const xPx = (x + 0.5) * s;
			ctx.moveTo(xPx, 0.5 * s);
			ctx.lineTo(xPx, (contents.height - 0.5) * s);
		}
		ctx.stroke();

		drawStarPoints();
	}

	function drawStarPoints()
	{
		ctx.fillStyle = fullStyle.lineColour;
		let starPoints = fullStyle.starPoints;
		if (starPoints === "auto")
			starPoints = getStarPoints();

		for (const [x, y] of starPoints)
		{
			ctx.beginPath();
			ctx.arc((x + 0.5) * s, (y + 0.5) * s, 3 * devicePixelRatio, 0, Math.PI * 2);
			ctx.fill();
		}

		function getStarPoints(): Coord[]
		{
			const starPoints: Coord[] = [];

			if (contents.width % 2 === 1 && contents.height % 2 === 1)
			{
				// Tengen
				starPoints.push([(contents.width - 1) * 0.5, (contents.height - 1) * 0.5]);
			}

			if (contents.width === 9 && contents.height === 9)
			{
				// 3-3 points
				starPoints.push([2, 2]);
				starPoints.push([2, 6]);
				starPoints.push([6, 2]);
				starPoints.push([6, 6]);
			}
			else if (contents.width > 9 && contents.height > 9)
			{
				// 4-4 points
				starPoints.push([3, 3]);
				starPoints.push([3, contents.height - 4]);
				starPoints.push([contents.width - 4, 3]);
				starPoints.push([contents.width - 4, contents.height - 4]);
			}

			if (contents.width >= 19 && contents.height >= 19)
			{
				if (contents.width % 2 === 1)
				{
					// Side star points
					starPoints.push([(contents.width - 1) * 0.5, 3]);
					starPoints.push([(contents.width - 1) * 0.5, contents.height - 4]);
				}
				if (contents.height % 2 === 1)
				{
					// Side star points
					starPoints.push([3, (contents.height - 1) * 0.5]);
					starPoints.push([contents.width - 4, (contents.height - 1) * 0.5]);
				}
			}
			return starPoints;
		}
	}

	function drawStones()
	{
		drawShadows();

		for (const [colour, stones] of Object.entries(contents.stones))
		{
			for (const [x, y] of stones)
			{
				const gradient = ctx.createRadialGradient(
					(x + 0.35) * s,
					(y + 0.35) * s,
					0,
					(x + 0.35) * s,
					(y + 0.35) * s,
					s * 0.7,
				);
				gradient.addColorStop(
					0,
					`color(from ${colour} srgb calc(r * 0.75 + 0.25) calc(g * 0.75 + 0.25) calc(b * 0.75 + 0.25))`,
				);
				gradient.addColorStop(
					1,
					`color(from ${colour} srgb calc(r * 0.75) calc(g * 0.75) calc(b * 0.75))`,
				);
				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc((x + 0.5) * s, (y + 0.5) * s, s * 0.5, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}

	function drawShadows()
	{
		ctx.save();
		ctx.globalCompositeOperation = "multiply";

		for (const [colour, stones] of Object.entries(contents.stones))
		{
			for (const [x, y] of stones)
			{
				const gradient = ctx.createRadialGradient(
					(x + 0.55) * s,
					(y + 0.55) * s,
					s * 0.3,
					(x + 0.55) * s,
					(y + 0.55) * s,
					s * 0.6,
				);
				gradient.addColorStop(
					0,
					`color(from ${colour} srgb calc(r * 0.5) calc(g * 0.5) calc(b * 0.5))`,
				);
				gradient.addColorStop(
					0.7,
					`color(from ${colour} srgb calc(r * 0.1 + 0.8) calc(g * 0.1 + 0.8) calc(b * 0.1 + 0.8))`,
				);
				gradient.addColorStop(1, "#ffffff");
				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc((x + 0.55) * s, (y + 0.55) * s, s * 0.6, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		ctx.restore();
	}
}
