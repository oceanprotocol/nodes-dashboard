import VantaBase, { VANTA } from './_base.js'
import { rn, ri, mobileCheck, getBrightness } from './helpers.js'

const win = typeof window == 'object'
let THREE = win && window.THREE

class Effect extends VantaBase {
  static initClass() {
    this.prototype.defaultOptions = {
      color: 0xff3f81,
      backgroundColor: 0x23153c,
      points: 10,
      maxDistance: 20,
      spacing: 15,
      showDots: true,
      nodeSize: 0.25, // Node size
      linkColor: 0xff3f81, // Link color
      lineThickness: 0.05 // Line thickness (radius of the cylinder)
    }
  }

  constructor(userOptions) {
    THREE = userOptions.THREE || THREE
    super(userOptions)
  }

  genPoint(x, y, z) {
    let sphere
    if (!this.points) {
      this.points = []
    }
    if (this.options.showDots) {
      const geometry = new THREE.SphereGeometry(this.options.nodeSize, 12, 12) // Use nodeSize from options
      const material = new THREE.MeshLambertMaterial({
        color: this.options.color
      })
      sphere = new THREE.Mesh(geometry, material)
    } else {
      sphere = new THREE.Object3D()
    }
    this.cont.add(sphere)
    sphere.ox = x
    sphere.oy = y
    sphere.oz = z
    sphere.position.set(x, y, z)
    sphere.r = rn(-2, 2) // rotation rate
    return this.points.push(sphere)
  }

  onInit() {
    this.points = [] // Initialize points array
    this.connections = [] // Initialize connections array
    this.cont = new THREE.Group()
    this.cont.position.set(0, 0, 0)
    this.scene.add(this.cont)

    let n = this.options.points
    let { spacing } = this.options
    if (mobileCheck()) {
      n = ~~(n * 0.75)
      spacing = ~~(spacing * 0.65)
    }

    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const y = ri(-3, 3)
        const x = (i - n / 2) * spacing + ri(-5, 5)
        let z = (j - n / 2) * spacing + ri(-5, 5)
        if (i % 2) {
          z += spacing * 0.5
        } // offset

        this.genPoint(x, y - ri(5, 15), z)
        this.genPoint(x + ri(-5, 5), y + ri(5, 15), z + ri(-5, 5))
      }
    }

    this.camera = new THREE.PerspectiveCamera(25, this.width / this.height, 0.01, 10000)
    this.camera.position.set(50, 100, 150)
    this.scene.add(this.camera)

    const ambience = new THREE.AmbientLight(0xffffff, 0.75)
    this.scene.add(ambience)

    this.spot = new THREE.SpotLight(0xffffff, 1)
    this.spot.position.set(0, 200, 0)
    this.spot.distance = 400
    this.spot.target = this.cont
    this.scene.add(this.spot)
  }

  onUpdate() {
    let diff
    const c = this.camera
    if (Math.abs(c.tx - c.position.x) > 0.01) {
      diff = c.tx - c.position.x
      c.position.x += diff * 0.02
    }
    if (Math.abs(c.ty - c.position.y) > 0.01) {
      diff = c.ty - c.position.y
      c.position.y += diff * 0.02
    }
    c.lookAt(new THREE.Vector3(0, 0, 0))

    // Clear previous connections
    this.connections.forEach((conn) => this.cont.remove(conn))
    this.connections = []

    const linkColor = new THREE.Color(this.options.linkColor)
    const material = new THREE.MeshBasicMaterial({ color: linkColor })

    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i]

      // Update point position if needed
      if (p.r !== 0) {
        let ang = Math.atan2(p.position.z, p.position.x)
        const dist = Math.sqrt(p.position.z * p.position.z + p.position.x * p.position.x)
        ang += 0.00025 * p.r
        p.position.x = dist * Math.cos(ang)
        p.position.z = dist * Math.sin(ang)
      }

      for (let j = i + 1; j < this.points.length; j++) {
        const p2 = this.points[j]
        const dx = p.position.x - p2.position.x
        const dy = p.position.y - p2.position.y
        const dz = p.position.z - p2.position.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        if (dist < this.options.maxDistance) {
          // Create a cylinder between p and p2
          const cylinderGeometry = new THREE.CylinderGeometry(
            this.options.lineThickness, // radiusTop
            this.options.lineThickness, // radiusBottom
            dist, // height
            8, // radialSegments
            1, // heightSegments
            true // openEnded
          )

          // Create mesh
          const cylinder = new THREE.Mesh(cylinderGeometry, material)

          // Position the cylinder
          const midpoint = new THREE.Vector3()
            .addVectors(p.position, p2.position)
            .multiplyScalar(0.5)
          cylinder.position.copy(midpoint)

          // Align the cylinder with the line between the points
          const direction = new THREE.Vector3()
            .subVectors(p2.position, p.position)
            .normalize()
          const axis = new THREE.Vector3(0, 1, 0)
          const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, direction)
          cylinder.setRotationFromQuaternion(quaternion)

          // Add the cylinder to the scene
          this.cont.add(cylinder)
          this.connections.push(cylinder)
        }
      }
    }
  }

  onMouseMove(x, y) {
    const c = this.camera
    if (!c.oy) {
      c.oy = c.position.y
      c.ox = c.position.x
      c.oz = c.position.z
    }
    const ang = Math.atan2(c.oz, c.ox)
    const dist = Math.sqrt(c.oz * c.oz + c.ox * c.ox)
    const tAng = ang + (x - 0.5) * 2 * (this.options.mouseCoeffX || 1)
    c.tz = dist * Math.sin(tAng)
    c.tx = dist * Math.cos(tAng)
    c.ty = c.oy + (y - 0.5) * 50 * (this.options.mouseCoeffY || 1)

    this.rcMouseX = x * 2 - 1
    this.rcMouseY = -y * 2 + 1
  }

  onDestroy() {
    if (this.scene) {
      // Remove connections
      this.connections.forEach((conn) => this.cont.remove(conn))
      this.connections = []
      // Remove points
      this.points.forEach((point) => this.cont.remove(point))
      this.points = []
    }
    // Remove other resources
    this.spot = null
  }

  setOptions(userOptions) {
    super.setOptions(userOptions)
    if (userOptions.color) {
      this.points.forEach((p) => {
        p.material.color = new THREE.Color(this.options.color)
      })
    }
    if (userOptions.nodeSize) {
      this.points.forEach((p) => {
        p.geometry = new THREE.SphereGeometry(this.options.nodeSize, 12, 12)
      })
    }
    if (userOptions.linkColor || userOptions.lineThickness) {
      // Recreate connections with new materials or geometry
      this.connections.forEach((conn) => this.cont.remove(conn))
      this.connections = []
      // Force update
      this.onUpdate()
    }
  }

  onRestart() {
    if (this.scene) {
      this.connections.forEach((conn) => this.cont.remove(conn))
      this.connections = []

      this.points.forEach((point) => this.cont.remove(point))
      this.points = []
    }
    this.onInit()
  }
}
Effect.initClass()
export default VANTA.register('NET', Effect)
