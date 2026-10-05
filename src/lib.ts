export interface BoardContent
{
	width: number;
	height: number;
}

export function drawBoard(canvas: HTMLCanvasElement, content: BoardContent)
{
	const w = canvas.width = canvas.clientWidth;
	const h = canvas.height = canvas.clientHeight;
	const ctx = canvas.getContext("2d")!;
	ctx.clearRect(0, 0, w, h);
	ctx.strokeStyle = "blue";
	ctx.strokeRect(10.5, 10.5, content.width, content.height);
}
