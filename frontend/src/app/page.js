export default function Page() {
  const htmlContent = `
  $(cat public/dashboard.html)
  `;

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  );
}
