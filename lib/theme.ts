export const THEME_KEY = "cazacartas:tema";

/** Corre antes de pintar la página, para que no "parpadee" en claro al abrir en modo oscuro */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
