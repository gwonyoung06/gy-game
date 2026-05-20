/**
 * AssetLoader — GLTFLoader 기반 GLB 모델 캐시 시스템
 *
 * 사용법:
 *   import { assetLoader } from './utils/AssetLoader.js';
 *   const model = await assetLoader.load('models/landmarks/fountain.glb');
 *   // model.scene 을 Three.js scene에 추가
 *
 * 특징:
 * - 동일 URL 중복 로드 방지 (Promise 캐시)
 * - 로드 실패 시 null 반환 → 호출 측에서 절차적 폴백 처리
 * - clone() 헬퍼: 씬에 여러 번 배치할 때 사용
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

class AssetLoader {
  constructor() {
    this._loader = new GLTFLoader();
    /** @type {Map<string, Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF | null>>} */
    this._cache  = new Map();
  }

  /**
   * GLB 파일 로드 (캐시 우선)
   * @param {string} url  예) 'models/landmarks/fountain.glb'
   * @returns {Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF | null>}
   */
  load(url) {
    if (this._cache.has(url)) return this._cache.get(url);

    const promise = new Promise((resolve) => {
      this._loader.load(
        url,
        (gltf) => {
          // 그림자 설정
          gltf.scene.traverse(o => {
            if (o.isMesh) {
              o.castShadow    = true;
              o.receiveShadow = true;
            }
          });
          resolve(gltf);
        },
        undefined,
        (err) => {
          console.warn(`[AssetLoader] 로드 실패: ${url}`, err);
          resolve(null); // 실패해도 null 반환 (폴백 사용)
        }
      );
    });

    this._cache.set(url, promise);
    return promise;
  }

  /**
   * 여러 모델 병렬 프리로드
   * @param {string[]} urls
   */
  preload(urls) {
    return Promise.all(urls.map(u => this.load(u)));
  }

  /**
   * GLTF scene 딥클론 — 같은 모델을 여러 위치에 배치할 때 사용
   * @param {import('three/examples/jsm/loaders/GLTFLoader.js').GLTF} gltf
   * @returns {THREE.Group}
   */
  clone(gltf) {
    return gltf.scene.clone(true);
  }

  /** 캐시 전체 초기화 */
  clear() {
    this._cache.clear();
  }
}

/** 싱글턴 인스턴스 */
export const assetLoader = new AssetLoader();
