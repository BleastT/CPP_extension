const { executeCommand } = require("./utils.js");
const { out } = require("./channels.js");
const path = require("path");
const fs = require("fs");
const { modifyFile } = require("./ymlFilesManager");
const vscode = require("vscode");

class GCC {
  async run(settings, files, origin) {
    for (let i = 0; i < files.length; i++) {
      out.appendLine("Compiling " + files[i].split("\\").at(-1));

      const res = await this.compile(settings, files[i], origin);

      if (res !== 0) {
        return res;
      }
    }

    return 0;
  }

  async compile(settings, file, origin) {
    const { version, includes, preprocessors } = setupSettings(
      settings,
      origin
    );
    const splitPath = file.split("\\");
    const fileName = splitPath.at(-1);
    const response = await executeCommand(
      `g++ -g ${version} ${preprocessors} ${includes} -c ${file} -o ${origin}/build/obj/${fileName}.o`
    );
    origin.replace("\\", "/");
    if (response.res !== 0) {
      out.appendLine(response.msg);
      return 1;
    } else {
      return 0;
    }
  }

  async link(settings, origin) {
    const { name, app_type, version, dependencies, librarys, ressources } =
      setupSettings(settings, origin);

    origin.replace("\\", "/");

    const response = await executeCommand(
      `g++ -g ${version} ${origin}/build/obj/*.o -o ${origin}/build/out/${name} ${dependencies} ${librarys}`
    );

    if (response.res !== 0) {
      out.appendLine(response.msg);
      return 1;
    } else {
      return 0;
    }
  }
}

class CLANG {
  async run(settings, files, origin) {
    for (let i = 0; i < files.length; i++) {
      out.appendLine("Compiling " + files[i].split("\\").at(-1));

      const res = await this.compile(settings, files[i], origin);

      if (res !== 0) {
        return res;
      }
    }

    return 0;
  }

  async compile(settings, file, origin) {
    const { version, includes, preprocessors } = setupSettings(
      settings,
      origin
    );
    const splitPath = file.split("\\");
    const fileName = splitPath.at(-1);
    const response = await executeCommand(
      `clang++ -g ${version} ${preprocessors} ${includes} -c ${file} -o ${origin}/build/obj/${fileName}.o`
    );
    origin.replace("\\", "/");
    if (response.res !== 0) {
      out.appendLine(response.msg);
      return 1;
    } else {
      return 0;
    }
  }

  async link(settings, origin) {
    const { name, app_type, version, dependencies, librarys } = setupSettings(
      settings,
      origin
    );

    // result = os.system(f'cmd /c"{compiler} {build_parameter} -g --std=c++{cpp_version} bin\\obj\\{DirPath}\\*.o -o bin\\build\\{app_name} {libs} {dependencies}"')
    origin.replace("\\", "/");

    const response = await executeCommand(
      `clang++ -g ${version} ${origin}/build/obj/*.o -o ${origin}/build/out/${name} ${dependencies} ${librarys}`
    );

    if (response.res !== 0) {
      out.appendLine(response.msg);
      return 1;
    } else {
      return 0;
    }
  }
}

const setupSettings = (settings, origin) => {
  const version =
    settings.cpp_version === "auto" ? "" : "--std=c++" + settings.cpp_version;
  var app_type = settings.application_type;
  var name = settings.name;
  var includes = "";
  var dependencies = "";
  var librarys = "";
  var preprocessors = "";
  settings.include.forEach((inc) => {
    if (inc !== "exemple") includes += `-I${path.join(origin, inc)} `;
  });
  settings.library_directory.forEach((dep) => {
    if (dep !== "exemple") dependencies += `-L${path.join(origin, dep)} `;
  });
  settings.library.forEach((lib) => {
    if (lib !== "exemple") librarys += `-l${lib} `;
  });
  settings.preprocessor.forEach((pre) => {
    if (pre !== "exemple") preprocessors += `-D${path.join(origin, pre)} `;
  });

  return {
    name: name,
    app_type: app_type,
    version: version,
    includes: includes,
    dependencies: dependencies,
    librarys: librarys,
    preprocessors: preprocessors,
  };
};

const compileFiles = async (files, settings, history, compiler, origin) => {
  if (settings.application_type !== "exe") {
    vscode.window.showErrorMessage(
      `This application type (${settings.application_type}) is not yet supported`
    );
    return;
  }
  const files_ = filterFiles(settings, history, files, origin);
  const projectName = origin.split("\\").at(-1).toUpperCase();
  if (files_.length === 0) {
    out.appendLine(
      "All files in " +
        projectName +
        " are up to date. Use 'CPP: Recompile project' to recompile the whole project"
    );
    return 0;
  }
  if (compiler === "g++") {
    const gcc = new GCC();
    out.appendLine("");
    out.appendLine("");
    out.appendLine("Building " + projectName + " project");
    out.appendLine("Starting compilation using g++");
    const res1 = await gcc.run(settings, files_, origin);
    if (res1 !== 0) {
      out.appendLine("Compilation failed. Aborting linking.");
      return 1;
    }
    out.appendLine("Starting linking using g++");
    const res2 = await gcc.link(settings, origin);
    if (res2 !== 0) {
      out.appendLine("Linking failed.");
      return 1;
    }
    out.appendLine("Successfully built the project. Check 'build/out'");
  } else if (compiler === "clang++") {
    const clang = new CLANG();
    out.appendLine("");
    out.appendLine("");
    out.appendLine("Building " + projectName + " project");
    out.appendLine("Starting compilation using clang++");
    const res1 = await clang.run(settings, files_, origin);
    if (res1 !== 0) {
      out.appendLine("Compilation failed. Aborting linking.");
      return 1;
    }
    out.appendLine("Starting linking using clang++");
    const res2 = await clang.link(settings, origin);
    if (res2 !== 0) {
      out.appendLine("Linking failed.");
      return 1;
    }
    out.appendLine("Successfully built the project. Check 'build/out'");
  }

  return 0;
};

const filterFiles = (settings, history, files, origin) => {
  //Deletes unused object files
  const objFiles = fs.readdirSync(path.join(origin, "build/obj"));
  for (let i = 0; i < objFiles.length; i++) {
    const objName = objFiles[i];
    var found = false;
    for (let b = 0; b < files.length; b++) {
      const fileName = files[b].split("\\").at(-1);

      if (objName === fileName + ".o") {
        found = true;
        break;
      }
    }

    if (!found) {
      fs.unlinkSync(path.join(origin, "build/obj/" + objFiles[i]), (err) => {
        console.log(err);
      });
    }
  }

  const his = history ? history : {};
  var finalFiles = [];

  for (let i = 0; i < files.length; i++) {
    var found = false;
    for (const [key, value] of Object.entries(his)) {
      if (files[i] === key) {
        const mTime = fs.statSync(files[i]).mtime;

        if (mTime > value.time) {
          finalFiles.push(files[i]);
          updatehistory(files[i], origin);
        } else {
          const hFiles = value.files;
          for (let i = 0; i < hFiles.length; i++) {
            const hmTime = fs.statSync(hFiles[i].file).mtime;

            if (hmTime > hFiles[i].time) {
              finalFiles.push(files[i]);
              updatehistory(files[i], origin);
              break;
            }
          }
        }
        found = true;
        break;
      }
    }

    if (!found) {
      finalFiles.push(files[i]);
      updatehistory(files[i], origin);
    }
  }
  return finalFiles;
};

const updatehistory = (file, origin) => {
  const data = fs.readFileSync(file, "utf-8");
  const currTime = new Date();
  // var mTime = fs.statSync(files[i]).mtime;
  var hFiles = [];

  data.split(/\r?\n/).forEach((line) => {
    if (line.includes("#include") && line.includes('"')) {
      var fileRootDir = "";
      const splitPath = file.split("\\");
      splitPath.forEach((word, index) => {
        if (index !== splitPath.length - 1) {
          fileRootDir += word + "/";
        }
      });
      const hname = line.split('"')[1].split('"')[0];

      const hpath = path.join(fileRootDir, hname);
      const hmTime = fs.statSync(hpath).mtime;

      hFiles.push({ file: hpath, time: hmTime });
    }
  });

  const save = { time: currTime, files: hFiles };
  modifyFile(file, save, path.join(origin, "build/config/history.yml"));
};

module.exports = { compileFiles };
