// Bundle the already packaged Electron app using Flatpak's standard build commands.
// No compilation occurs here, so the installed Platform is also the build environment.
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const project=path.resolve(__dirname,'..');
const config=require('../package.json');
const appId=config.build.appId;
function run(args){console.log(`flatpak ${args.join(' ')}`);const r=spawnSync('flatpak',args,{stdio:'inherit',cwd:project});if(r.error)throw r.error;if(r.status!==0)throw new Error(`Flatpak command failed (${r.status}).`);}
(async()=>{
  const unpacked=path.join(project,'release/linux-unpacked');
  await fs.access(path.join(unpacked,'orbit'));
  const work=await fs.mkdtemp(path.join(project,'release/flatpak-build-'));
  const build=path.join(work,'app'),repo=path.join(work,'repo');
  run(['build-init','--arch=x86_64','--base=org.electronjs.Electron2.BaseApp','--base-version=25.08',build,appId,'org.freedesktop.Platform','org.freedesktop.Platform','25.08']);
  const files=path.join(build,'files');
  await fs.cp(unpacked,path.join(files,'lib',appId),{recursive:true});
  await fs.mkdir(path.join(files,'bin'),{recursive:true});
  await fs.writeFile(path.join(files,'bin','orbit'),`#!/bin/sh\nexport TMPDIR="$XDG_RUNTIME_DIR/app/$FLATPAK_ID"\nexec zypak-wrapper /app/lib/${appId}/orbit "$@"\n`,{mode:0o755});
  for(const dir of ['share/applications','share/icons/hicolor/512x512/apps','share/metainfo'])await fs.mkdir(path.join(files,dir),{recursive:true});
  await fs.copyFile(path.join(project,'assets/icon.png'),path.join(files,'share/icons/hicolor/512x512/apps',`${appId}.png`));
  await fs.writeFile(path.join(files,'share/applications',`${appId}.desktop`),`[Desktop Entry]\nType=Application\nName=Orbit\nComment=Your machine, understood\nExec=orbit\nIcon=${appId}\nTerminal=false\nCategories=System;Monitor;\nStartupWMClass=${config.desktopName}\n`);
  await fs.writeFile(path.join(files,'share/metainfo',`${appId}.metainfo.xml`),`<?xml version="1.0" encoding="UTF-8"?>\n<component type="desktop-application"><id>${appId}</id><name>Orbit</name><summary>A local desktop control center</summary><metadata_license>CC0-1.0</metadata_license><project_license>MIT</project_license><description><p>Understand system performance, running processes, storage use, and diagnostic evidence in an animated glass interface.</p></description><launchable type="desktop-id">${appId}.desktop</launchable><content_rating type="oars-1.1"/><releases><release version="${config.version}" date="2026-11-17"/></releases></component>\n`);
  run(['build-finish',...config.build.flatpak.finishArgs,'--command=orbit',build]);
  run(['build-export','--arch=x86_64',repo,build,'stable']);
  const output=path.join(project,'release',`Orbit-${config.version}-linux-x86_64.flatpak`);
  run(['build-bundle','--arch=x86_64','--runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo',repo,output,appId,'stable']);
  console.log(`Bundle ready: ${output}\nBuild tree retained for verification: ${build}`);
})().catch(e=>{console.error(e);process.exitCode=1;});
