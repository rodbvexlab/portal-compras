export async function handle(request: Request) {
  return Response.json(
    {
      message:
        "Public account registration is disabled. Contact an administrator.",
    },
    { status: 403 }
  );
}
