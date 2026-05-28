import { Icon } from "../components/ui/Icon";

export function PlaceholderPage({ title, description }) {
  return (
    <>
      <div className="ms-page-head">
        <div>
          <h1 className="ms-page-title">{title}</h1>
          <p className="ms-page-desc">{description}</p>
        </div>
      </div>
      <div className="ms-card">
        <div className="ms-empty">
          <div className="ms-empty-ico"><Icon name="spark" size={26} /></div>
          <h3 className="ms-empty-title">Módulo em evolução</h3>
          <p className="ms-empty-desc">Esta área está preparada para expansão funcional sem alterar a base estável do MapaSeller.</p>
        </div>
      </div>
    </>
  );
}
