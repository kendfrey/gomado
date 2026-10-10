export type Coord = [number, number];

export interface BoardContents
{
	width: number;
	height: number;
	stones: Record<string, Coord[]>;
	labels?: [Coord, string][];
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

	const stones = new Map<string, string>(
		Object.entries(contents.stones).flatMap(([colour, coords]) => coords.map(([x, y]) => [`${x},${y}`, colour])),
	);

	drawBackground();
	drawLines();
	drawStones();
	drawLabels();
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
		const linesCanvas = new OffscreenCanvas(contents.width * s, contents.height * s);
		const linesCtx = linesCanvas.getContext("2d")!;
		linesCtx.strokeStyle = fullStyle.lineColour;
		linesCtx.lineWidth = devicePixelRatio;
		linesCtx.lineCap = "square";
		linesCtx.beginPath();
		for (let y = 0; y < contents.height; y++)
		{
			const yPx = (y + 0.5) * s;
			linesCtx.moveTo(0.5 * s, yPx);
			linesCtx.lineTo((contents.width - 0.5) * s, yPx);
		}
		for (let x = 0; x < contents.width; x++)
		{
			const xPx = (x + 0.5) * s;
			linesCtx.moveTo(xPx, 0.5 * s);
			linesCtx.lineTo(xPx, (contents.height - 0.5) * s);
		}
		linesCtx.stroke();

		linesCtx.fillStyle = fullStyle.lineColour;
		let starPoints = fullStyle.starPoints;
		if (starPoints === "auto")
			starPoints = getStarPoints();

		for (const [x, y] of starPoints)
		{
			linesCtx.beginPath();
			linesCtx.arc((x + 0.5) * s, (y + 0.5) * s, 3 * devicePixelRatio, 0, Math.PI * 2);
			linesCtx.fill();
		}

		if (contents.labels)
		{
			for (const [[x, y], _] of contents.labels)
				linesCtx.clearRect(x * s, y * s, s, s);
		}

		ctx.drawImage(linesCanvas, 0, 0);
	}

	function drawStones()
	{
		drawShadows();

		for (const [colour, stones] of Object.entries(contents.stones))
		{
			for (const [x, y] of stones)
			{
				ctx.fillStyle = shineGradient(colour, x, y);
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

	function drawLabels()
	{
		if (!contents.labels)
			return;

		ctx.textAlign = "center";
		ctx.textBaseline = "top";
		ctx.font = `bold ${s * 0.7}px Arial, Helvetica, sans-serif`;
		for (const [[x, y], label] of contents.labels)
		{
			const stoneColour = stones.get(`${x},${y}`);
			const labelColour = stoneColour !== undefined
				? shineGradient(`oklch(from ${stoneColour} calc(max(0, min(1, (l - 0.5) * -infinity))) 0 0)`, x, y)
				: fullStyle.lineColour;
			ctx.lineWidth = s * 0.075;
			ctx.strokeStyle = labelColour;
			ctx.fillStyle = labelColour;
			switch (label)
			{
				case "circle":
					ctx.beginPath();
					ctx.arc((x + 0.5) * s, (y + 0.5) * s, s * 0.25, 0, Math.PI * 2);
					ctx.stroke();
					break;
				case "cross":
					ctx.beginPath();
					ctx.moveTo((x + 0.25) * s, (y + 0.25) * s);
					ctx.lineTo((x + 0.75) * s, (y + 0.75) * s);
					ctx.moveTo((x + 0.75) * s, (y + 0.25) * s);
					ctx.lineTo((x + 0.25) * s, (y + 0.75) * s);
					ctx.stroke();
					break;
				case "square":
					ctx.beginPath();
					ctx.rect((x + 0.25) * s, (y + 0.25) * s, s * 0.5, s * 0.5);
					ctx.stroke();
					break;
				case "triangle":
					ctx.beginPath();
					ctx.moveTo((x + 0.5) * s, (y + 0.2) * s);
					ctx.lineTo((x + 0.5 + Math.sqrt(3) * 0.15) * s, (y + 0.65) * s);
					ctx.lineTo((x + 0.5 - Math.sqrt(3) * 0.15) * s, (y + 0.65) * s);
					ctx.closePath();
					ctx.stroke();
					break;
				default:
					ctx.fillText(
						label,
						(x + 0.5) * s,
						(y + 0.5) * s - ctx.measureText(label).actualBoundingBoxDescent * 0.5,
					);
					break;
			}
		}
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

	function shineGradient(colour: string, x: number, y: number)
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
		return gradient;
	}
}
