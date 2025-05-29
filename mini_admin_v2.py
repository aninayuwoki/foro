#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sistema de Moderación Automática en Tiempo Real - Monitoreo Web con Notificaciones Windows
Monitorea continuamente una página web y analiza nuevas publicaciones automáticamente
Obtiene datos directamente del servidor web y envía notificaciones nativas de Windows con sonido
"""

import json
import re
import requests
import time
from datetime import datetime
from typing import List, Dict, Optional
import argparse
from bs4 import BeautifulSoup
import hashlib
import platform

# Importaciones para notificaciones Windows
import subprocess
import os

# Intentar importar librerías opcionales para mejores notificaciones
try:
    import winsound  # Para sonidos en Windows
    WINSOUND_AVAILABLE = True
except ImportError:
    WINSOUND_AVAILABLE = False

try:
    from plyer import notification  # Para notificaciones multiplataforma
    PLYER_AVAILABLE = True
except ImportError:
    PLYER_AVAILABLE = False

class NotificadorWindows:
    """Maneja las notificaciones nativas de Windows con sonido"""
    
    def __init__(self):
        self.sistema = platform.system()
        self.es_windows = self.sistema == "Windows"
        
        if self.es_windows:
            print("🔔 Sistema Windows detectado - Notificaciones habilitadas")
        else:
            print(f"⚠️  Sistema {self.sistema} detectado - Funcionalidad limitada")
    
    def reproducir_sonido_critico(self):
        """Reproduce sonido para infracciones críticas"""
        if not self.es_windows:
            return
            
        try:
            if WINSOUND_AVAILABLE:
                # Sonido de error crítico del sistema
                winsound.PlaySound("SystemHand", winsound.SND_ALIAS | winsound.SND_ASYNC)
                time.sleep(0.5)
                winsound.PlaySound("SystemHand", winsound.SND_ALIAS | winsound.SND_ASYNC)
            else:
                # Alternativa usando PowerShell
                subprocess.run([
                    "powershell", "-Command", 
                    "[console]::beep(800,300); [console]::beep(600,300); [console]::beep(800,300)"
                ], shell=True, capture_output=True)
        except Exception as e:
            print(f"❌ Error reproduciendo sonido crítico: {e}")
    
    def reproducir_sonido_normal(self):
        """Reproduce sonido para infracciones normales"""
        if not self.es_windows:
            return
            
        try:
            if WINSOUND_AVAILABLE:
                # Sonido de notificación del sistema
                winsound.PlaySound("SystemNotification", winsound.SND_ALIAS | winsound.SND_ASYNC)
            else:
                # Alternativa usando PowerShell
                subprocess.run([
                    "powershell", "-Command", 
                    "[console]::beep(600,200)"
                ], shell=True, capture_output=True)
        except Exception as e:
            print(f"❌ Error reproduciendo sonido normal: {e}")
    
    def enviar_notificacion_windows(self, titulo: str, mensaje: str, es_critica: bool = False):
        """Envía notificación nativa de Windows"""
        if not self.es_windows:
            print(f"📱 {titulo}: {mensaje}")
            return
        
        try:
            # Método 1: Usar plyer si está disponible (más bonito)
            if PLYER_AVAILABLE:
                icono = "warning" if es_critica else "info"
                notification.notify(
                    title=titulo,
                    message=mensaje,
                    app_name="Moderador Web",
                    timeout=10 if es_critica else 5
                )
            else:
                # Método 2: Usar PowerShell con toast notification
                mensaje_escapado = mensaje.replace('"', '`"').replace("'", "''")
                titulo_escapado = titulo.replace('"', '`"').replace("'", "''")
                
                ps_script = f'''
                Add-Type -AssemblyName System.Windows.Forms
                $notification = New-Object System.Windows.Forms.NotifyIcon
                $notification.Icon = [System.Drawing.SystemIcons]::{"Warning" if es_critica else "Information"}
                $notification.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::{"Warning" if es_critica else "Info"}
                $notification.BalloonTipText = "{mensaje_escapado}"
                $notification.BalloonTipTitle = "{titulo_escapado}"
                $notification.Visible = $true
                $notification.ShowBalloonTip({"10000" if es_critica else "5000"})
                Start-Sleep -Seconds 1
                $notification.Dispose()
                '''
                
                subprocess.run([
                    "powershell", "-WindowStyle", "Hidden", "-Command", ps_script
                ], shell=True, capture_output=True, timeout=30)
                
        except Exception as e:
            print(f"❌ Error enviando notificación Windows: {e}")
            # Fallback a notificación en consola
            print(f"🔔 {titulo}: {mensaje}")
    
    def notificar_infraccion(self, infraccion: Dict):
        """Notifica una infracción específica con sonido apropiado"""
        niveles = [i['nivel'] for i in infraccion['infracciones']]
        es_critica = 'CRÍTICO' in niveles
        max_nivel = 'CRÍTICO' if es_critica else 'ALTO' if 'ALTO' in niveles else 'MEDIO' if 'MEDIO' in niveles else 'BAJO'
        
        # Preparar mensaje
        tipos_infracciones = list(set([i['tipo'] for i in infraccion['infracciones']]))
        titulo = f"🚨 Infracción {max_nivel} Detectada" if es_critica else f"⚠️ Infracción {max_nivel}"
        
        mensaje = f"Usuario: {infraccion['autor']}\n"
        mensaje += f"Tipos: {', '.join(tipos_infracciones[:2])}"
        if len(tipos_infracciones) > 2:
            mensaje += f" y {len(tipos_infracciones)-2} más"
        mensaje += f"\nID: {infraccion['id'][:8]}..."
        
        # Reproducir sonido apropiado
        if es_critica:
            self.reproducir_sonido_critico()
        else:
            self.reproducir_sonido_normal()
        
        # Enviar notificación
        self.enviar_notificacion_windows(titulo, mensaje, es_critica)
        
        # Si es crítica, enviar notificación adicional después de un momento
        if es_critica:
            time.sleep(2)
            self.enviar_notificacion_windows(
                "🔴 ALERTA CRÍTICA PERSISTENTE", 
                f"Revisar inmediatamente: {tipos_infracciones[0]}\nUsuario: {infraccion['autor']}", 
                True
            )

class ModeradorWebTiempoReal:
    def __init__(self, url_base: str, intervalo: int = 10):
        self.url_base = url_base.rstrip('/')
        self.intervalo = intervalo
        self.publicaciones_procesadas = set()
        self.running = True
        self.notificador = NotificadorWindows()
        
        # URLs posibles para obtener datos
        self.posibles_urls_datos = [
            f"{self.url_base}/data/publicaciones.json",
            f"{self.url_base}/publicaciones.json",
            f"{self.url_base}/api/publicaciones",
            f"{self.url_base}/api/posts",
        ]
        
        # Palabras clave para diferentes tipos de infracciones
        self.palabras_ofensivas = [
            'idiota', 'estúpido', 'imbécil', 'pendejo', 'cabron', 'cabrón', 
            'maldito', 'jodido', 'puto', 'puta', 'coño', 'mierda', 'cagada',
            'marica', 'maricon', 'maricón', 'gay' # cuando se usa como insulto
        ]
        
        self.palabras_discriminatorias = [
            'negro de mierda', 'indio sucio', 'cholo', 'serrano', 'costeño',
            'blanco privilegiado', 'mestizo', 'zambo', 'mulato',
            'gordo asqueroso', 'flaco', 'enano', 'gigante',
            'discapacitado inútil', 'loco', 'retrasado', 'mongólico'
        ]
        
        self.palabras_amenazas = [
            'te voy a matar', 'voy a matarte', 'te voy a joder', 'te voy a partir',
            'te voy a romper', 'voy a acabar contigo', 'te voy a destruir',
            'espérame', 'ya sé dónde vives', 'te voy a encontrar', 'cuidate',
            'bomba', 'explotar', 'quemar', 'incendiar'
        ]
        
        self.palabras_contenido_adulto = [
            'sexo', 'coger', 'follar', 'tirar', 'hacer el amor',
            'pene', 'vagina', 'tetas', 'culo', 'trasero', 'nalgas',
            'masturbarse', 'pajas', 'orgasmo', 'eyacular', 'correrse',
            'desnudo', 'desnuda', 'porn', 'xxx', 'caliente', 'excitado'
        ]
        
        self.palabras_drogas_ilegales = [
            'cocaína', 'coca', 'perico', 'marihuana', 'hierba', 'mota',
            'éxtasis', 'heroína', 'crack', 'lsd', 'speed', 'cristal',
            'drogas', 'narcóticos', 'dealer', 'camello', 'vender droga',
            'comprar droga', 'conseguir droga'
        ]
        
        self.palabras_informacion_personal = [
            'mi número es', 'llámame al', 'mi teléfono', 'mi celular',
            'mi dirección', 'vivo en', 'mi casa queda',
            'whatsapp', 'instagram', 'facebook', 'telegram',
            '@', 'cedula', 'cédula', 'dni', 'pasaporte'
        ]
        
        # Patrones regex para detectar información sensible
        self.patron_telefono = re.compile(r'\b\d{7,10}\b|\b\(\d{3}\)\s*\d{3}-\d{4}\b')
        self.patron_email = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
        self.patron_cedula = re.compile(r'\b\d{8,10}\b')
        self.patron_direccion = re.compile(r'\b(calle|carrera|avenida|av|cr|cl)\s+\d+', re.IGNORECASE)
        
        print(f"🤖 Moderador Web con Notificaciones iniciado")
        print(f"🌐 URL base: {self.url_base}")
        print(f"⏱️  Intervalo de verificación: {self.intervalo} segundos")
        print(f"🔍 Buscando endpoint de datos...")
        
    def encontrar_endpoint_datos(self) -> Optional[str]:
        """Encuentra el endpoint correcto para obtener los datos"""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/html, */*'
        }
        
        for url in self.posibles_urls_datos:
            try:
                print(f"🔍 Probando: {url}")
                response = requests.get(url, headers=headers, timeout=10)
                if response.status_code == 200:
                    # Intentar parsear como JSON
                    try:
                        data = response.json()
                        if isinstance(data, list) and len(data) > 0:
                            print(f"✅ Endpoint encontrado: {url}")
                            return url
                    except json.JSONDecodeError:
                        pass
                        
            except requests.exceptions.RequestException as e:
                print(f"❌ Error con {url}: {e}")
                continue
        
        # Si no encuentra endpoint JSON, intentar extraer de HTML
        try:
            print(f"🔍 Intentando extraer datos del HTML principal...")
            response = requests.get(f"{self.url_base}/index.html", headers=headers, timeout=10)
            if response.status_code == 200:
                return f"{self.url_base}/index.html"
        except:
            pass
            
        return None
    
    def obtener_publicaciones_json(self, url: str) -> List[Dict]:
        """Obtiene publicaciones desde un endpoint JSON"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"❌ Error obteniendo datos JSON: {e}")
            return []
    
    def obtener_publicaciones_html(self, url: str) -> List[Dict]:
        """Extrae publicaciones desde HTML usando BeautifulSoup"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            publicaciones = []
            
            # Buscar diferentes patrones comunes para publicaciones
            # Ajusta estos selectores según tu HTML específico
            posibles_selectores = [
                '.post', '.publicacion', '.mensaje', '.confession',
                '[data-post]', '[data-id]', '.post-item', '.item'
            ]
            
            for selector in posibles_selectores:
                posts = soup.select(selector)
                if posts:
                    print(f"📝 Encontrados {len(posts)} posts con selector: {selector}")
                    for i, post in enumerate(posts):
                        pub = {
                            'id': post.get('data-id', f'html-post-{i}'),
                            'mensaje': post.get_text(strip=True),
                            'fecha': datetime.now().isoformat(),
                            'nombre': 'Anónimo'
                        }
                        publicaciones.append(pub)
                    break
            
            # Si no encuentra posts con selectores específicos, buscar en scripts
            if not publicaciones:
                scripts = soup.find_all('script')
                for script in scripts:
                    if script.string and ('publicaciones' in script.string or 'posts' in script.string):
                        # Intentar extraer JSON embedded
                        try:
                            # Buscar patrones como: var publicaciones = [...]
                            match = re.search(r'(?:publicaciones|posts)\s*=\s*(\[.*?\]);?', script.string, re.DOTALL)
                            if match:
                                data = json.loads(match.group(1))
                                publicaciones.extend(data)
                                break
                        except:
                            continue
            
            return publicaciones
            
        except Exception as e:
            print(f"❌ Error obteniendo datos HTML: {e}")
            return []
    
    def obtener_publicaciones(self) -> List[Dict]:
        """Obtiene publicaciones del servidor web"""
        endpoint = self.encontrar_endpoint_datos()
        if not endpoint:
            print("❌ No se pudo encontrar endpoint de datos")
            return []
        
        if endpoint.endswith('.json') or '/api/' in endpoint:
            return self.obtener_publicaciones_json(endpoint)
        else:
            return self.obtener_publicaciones_html(endpoint)
    
    def generar_id_publicacion(self, pub: Dict) -> str:
        """Genera un ID único para una publicación"""
        # Usar ID existente si está disponible
        if 'id' in pub and pub['id']:
            return str(pub['id'])
        
        # Generar hash basado en contenido y fecha
        contenido = f"{pub.get('mensaje', '')}{pub.get('fecha', '')}{pub.get('nombre', '')}"
        return hashlib.md5(contenido.encode()).hexdigest()[:12]
    
    def verificar_palabras_prohibidas(self, texto: str, lista_palabras: List[str]) -> List[str]:
        """Verifica si el texto contiene palabras de una lista prohibida"""
        texto_lower = texto.lower()
        palabras_encontradas = []
        
        for palabra in lista_palabras:
            if palabra.lower() in texto_lower:
                palabras_encontradas.append(palabra)
                
        return palabras_encontradas
    
    def verificar_patrones_regex(self, texto: str) -> Dict[str, List[str]]:
        """Verifica patrones regex para información personal"""
        resultados = {}
        
        telefonos = self.patron_telefono.findall(texto)
        if telefonos:
            resultados['teléfonos'] = telefonos
            
        emails = self.patron_email.findall(texto)
        if emails:
            resultados['emails'] = emails
            
        cedulas = self.patron_cedula.findall(texto)
        if cedulas:
            resultados['cédulas'] = cedulas
            
        direcciones = self.patron_direccion.findall(texto)
        if direcciones:
            resultados['direcciones'] = direcciones
            
        return resultados
    
    def analizar_publicacion(self, pub: Dict) -> Optional[Dict]:
        """Analiza una publicación individual y retorna infracciones encontradas"""
        pub_id = self.generar_id_publicacion(pub)
        
        infracciones = {
            'id': pub_id,
            'autor': pub.get('nombre', 'Anónimo'),
            'fecha': pub.get('fecha', 'Sin fecha'),
            'mensaje_preview': pub.get('mensaje', '')[:100] + '...' if len(pub.get('mensaje', '')) > 100 else pub.get('mensaje', ''),
            'infracciones': []
        }
        
        mensaje = pub.get('mensaje', '')
        
        # Verificar contenido ofensivo
        palabras_ofensivas = self.verificar_palabras_prohibidas(mensaje, self.palabras_ofensivas)
        if palabras_ofensivas:
            infracciones['infracciones'].append({
                'tipo': 'Contenido Ofensivo',
                'nivel': 'MEDIO',
                'detalles': f"Palabras encontradas: {', '.join(palabras_ofensivas)}"
            })
        
        # Verificar discriminación
        palabras_discriminatorias = self.verificar_palabras_prohibidas(mensaje, self.palabras_discriminatorias)
        if palabras_discriminatorias:
            infracciones['infracciones'].append({
                'tipo': 'Discriminación',
                'nivel': 'ALTO',
                'detalles': f"Palabras encontradas: {', '.join(palabras_discriminatorias)}"
            })
        
        # Verificar amenazas
        palabras_amenazas = self.verificar_palabras_prohibidas(mensaje, self.palabras_amenazas)
        if palabras_amenazas:
            infracciones['infracciones'].append({
                'tipo': 'Amenazas',
                'nivel': 'CRÍTICO',
                'detalles': f"Palabras encontradas: {', '.join(palabras_amenazas)}"
            })
        
        # Verificar contenido adulto
        palabras_adulto = self.verificar_palabras_prohibidas(mensaje, self.palabras_contenido_adulto)
        if palabras_adulto:
            infracciones['infracciones'].append({
                'tipo': 'Contenido Adulto',
                'nivel': 'MEDIO',
                'detalles': f"Palabras encontradas: {', '.join(palabras_adulto[:3])}" + (' y más...' if len(palabras_adulto) > 3 else '')
            })
        
        # Verificar drogas ilegales
        palabras_drogas = self.verificar_palabras_prohibidas(mensaje, self.palabras_drogas_ilegales)
        if palabras_drogas:
            infracciones['infracciones'].append({
                'tipo': 'Drogas Ilegales',
                'nivel': 'ALTO',
                'detalles': f"Palabras encontradas: {', '.join(palabras_drogas)}"
            })
        
        # Verificar información personal
        palabras_personal = self.verificar_palabras_prohibidas(mensaje, self.palabras_informacion_personal)
        patrones_personal = self.verificar_patrones_regex(mensaje)
        
        if palabras_personal or patrones_personal:
            detalles = []
            if palabras_personal:
                detalles.append(f"Palabras: {', '.join(palabras_personal)}")
            if patrones_personal:
                for tipo, valores in patrones_personal.items():
                    detalles.append(f"{tipo}: {', '.join(valores)}")
            
            infracciones['infracciones'].append({
                'tipo': 'Información Personal',
                'nivel': 'ALTO',
                'detalles': '; '.join(detalles)
            })
        
        # Verificar longitud excesiva (spam)
        if len(mensaje) > 2000:
            infracciones['infracciones'].append({
                'tipo': 'Mensaje Excesivamente Largo',
                'nivel': 'BAJO',
                'detalles': f"Longitud: {len(mensaje)} caracteres"
            })
        
        # Verificar spam de caracteres repetidos
        if re.search(r'(.)\1{10,}', mensaje):
            infracciones['infracciones'].append({
                'tipo': 'Spam de Caracteres',
                'nivel': 'MEDIO',
                'detalles': "Contiene caracteres repetidos excesivamente"
            })
        
        # Verificar mayúsculas excesivas (GRITOS)
        palabras_mayuscula = len(re.findall(r'\b[A-Z]{4,}\b', mensaje))
        if palabras_mayuscula > 3:
            infracciones['infracciones'].append({
                'tipo': 'Mayúsculas Excesivas',
                'nivel': 'BAJO',
                'detalles': f"Palabras en mayúsculas: {palabras_mayuscula}"
            })
        
        return infracciones if infracciones['infracciones'] else None
    
    def procesar_nuevas_publicaciones(self, publicaciones: List[Dict]) -> List[Dict]:
        """Procesa solo las publicaciones nuevas"""
        nuevas_infracciones = []
        
        for pub in publicaciones:
            pub_id = self.generar_id_publicacion(pub)
            
            if pub_id not in self.publicaciones_procesadas:
                self.publicaciones_procesadas.add(pub_id)
                resultado = self.analizar_publicacion(pub)
                
                if resultado:
                    nuevas_infracciones.append(resultado)
                    
                    # 🔔 ENVIAR NOTIFICACIÓN INMEDIATA CON SONIDO
                    self.notificador.notificar_infraccion(resultado)
                    
                    # Notificación en consola para infracciones críticas
                    niveles_criticos = [inf['nivel'] for inf in resultado['infracciones']]
                    if 'CRÍTICO' in niveles_criticos:
                        print(f"\n🚨 ALERTA CRÍTICA - ID: {pub_id}")
                        print(f"⚠️  {resultado['mensaje_preview']}")
                        for inf in resultado['infracciones']:
                            if inf['nivel'] == 'CRÍTICO':
                                print(f"🔴 {inf['tipo']}: {inf['detalles']}")
                        print("-" * 50)
        
        return nuevas_infracciones
    
    def mostrar_notificacion(self, infracciones: List[Dict]):
        """Muestra notificación de nuevas infracciones en consola"""
        if not infracciones:
            return
            
        print(f"\n📢 {len(infracciones)} nueva(s) infracción(es) detectada(s) - {datetime.now().strftime('%H:%M:%S')}")
        print("=" * 60)
        
        for inf in infracciones:
            niveles = [i['nivel'] for i in inf['infracciones']]
            max_nivel = 'CRÍTICO' if 'CRÍTICO' in niveles else 'ALTO' if 'ALTO' in niveles else 'MEDIO' if 'MEDIO' in niveles else 'BAJO'
            
            emoji = {'CRÍTICO': '🔴', 'ALTO': '🟠', 'MEDIO': '🟡', 'BAJO': '🟢'}[max_nivel]
            
            print(f"{emoji} ID: {inf['id'][:8]}... | {inf['autor']}")
            print(f"   💬 {inf['mensaje_preview']}")
            
            for infr in inf['infracciones']:
                print(f"   🚨 {infr['tipo']} ({infr['nivel']})")
        
        print("=" * 60)
    
    def monitorear_continuamente(self):
        """Ejecuta el monitoreo continuo"""
        print(f"\n🟢 Iniciando monitoreo continuo con notificaciones...")
        print(f"⏰ Verificando cada {self.intervalo} segundos")
        print(f"🔔 Notificaciones Windows habilitadas")
        print(f"⌨️  Presiona Ctrl+C para detener\n")
        
        try:
            while self.running:
                try:
                    publicaciones = self.obtener_publicaciones()
                    
                    if publicaciones:
                        nuevas_infracciones = self.procesar_nuevas_publicaciones(publicaciones)
                        self.mostrar_notificacion(nuevas_infracciones)
                        
                        print(f"🔄 {datetime.now().strftime('%H:%M:%S')} - Verificado: {len(publicaciones)} posts, Procesadas: {len(self.publicaciones_procesadas)} total")
                    else:
                        print(f"⚠️  {datetime.now().strftime('%H:%M:%S')} - No se obtuvieron publicaciones")
                    
                except Exception as e:
                    print(f"❌ Error durante monitoreo: {e}")
                
                # Esperar antes de la siguiente verificación
                time.sleep(self.intervalo)
                
        except KeyboardInterrupt:
            print(f"\n🛑 Monitoreo detenido por el usuario")
            self.running = False
        except Exception as e:
            print(f"\n💥 Error fatal: {e}")
            self.running = False

def instalar_dependencias():
    """Instala las dependencias necesarias"""
    paquetes_requeridos = ['requests', 'beautifulsoup4']
    paquetes_opcionales = ['plyer']  # Para mejores notificaciones
    
    import subprocess
    import sys
    
    try:
        # Instalar paquetes requeridos
        for paquete in paquetes_requeridos:
            try:
                __import__(paquete.replace('-', '_'))
            except ImportError:
                print(f"📦 Instalando {paquete}...")
                subprocess.run([sys.executable, '-m', 'pip', 'install', paquete], check=True)
        
        # Intentar instalar paquetes opcionales
        for paquete in paquetes_opcionales:
            try:
                __import__(paquete)
            except ImportError:
                try:
                    print(f"📦 Instalando {paquete} (opcional)...")
                    subprocess.run([sys.executable, '-m', 'pip', 'install', paquete], check=True)
                    print(f"✅ {paquete} instalado - Notificaciones mejoradas disponibles")
                except:
                    print(f"⚠️  No se pudo instalar {paquete} - Se usarán notificaciones básicas")
        
        print("✅ Todas las dependencias están listas")
        
    except Exception as e:
        print(f"❌ Error instalando dependencias: {e}")

def main():
    parser = argparse.ArgumentParser(description='Sistema de Moderación Web en Tiempo Real con Notificaciones Windows')
    parser.add_argument('--url', '-u', required=True,
                       help='URL base del sitio web a monitorear')
    parser.add_argument('--intervalo', '-i', type=int, default=10,
                       help='Intervalo de verificación en segundos (default: 10)')
    
    args = parser.parse_args()
    
    # Instalar dependencias
    instalar_dependencias()
    
    moderador = ModeradorWebTiempoReal(args.url, args.intervalo)
    moderador.monitorear_continuamente()

if __name__ == "__main__":
    main()